import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import Common "../types/common";
import CustomerTypes "../types/customers";
import UserTypes "../types/users";

module {
  public type CustomerStore = Map.Map<Common.CustomerId, CustomerTypes.Customer>;
  public type BodyCompositionStore = Map.Map<Text, CustomerTypes.BodyCompositionEntry>;

  func callerProfileKey(userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId) : Common.ProfileKey {
    switch (userStore.get(caller)) {
      case (?up) up.profile_key;
      case null Runtime.trap("Caller has no profile");
    }
  };

  func toPublic(c : CustomerTypes.Customer) : CustomerTypes.CustomerPublic {
    {
      id = c.id;
      profile_key = c.profile_key;
      name = c.name;
      phone = c.phone;
      email = c.email;
      address = c.address;
      created_at = c.created_at;
      total_sales = c.total_sales;
      last_purchase_at = c.last_purchase_at;
      lifetime_revenue = c.lifetime_revenue;
      discount_applicable = c.discount_applicable;
      discount_value = c.discount_value;
      notes = c.notes;
      date_of_birth = c.date_of_birth;
      gender = c.gender;
    }
  };

  /// Simple fuzzy match: lowercased name has a shared substring of 3+ chars
  func isSimilar(a : Text, b : Text) : Bool {
    let al = a.toLower();
    let bl = b.toLower();
    if (al == bl) return true;
    let aChars = al.toArray();
    let bChars = bl.toArray();
    let aLen = aChars.size();
    let bLen = bChars.size();
    if (aLen < 3 or bLen < 3) return al == bl;
    // Check if any 3-char substring of a appears in b
    var i : Nat = 0;
    label outer while (i + 3 <= aLen) {
      let sub = Text.fromArray([aChars[i], aChars[i + 1], aChars[i + 2]]);
      if (bl.contains(#text sub)) return true;
      i += 1;
    };
    false
  };

  /// List all customers for the caller's profile
  public func getCustomers(store : CustomerStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId) : [CustomerTypes.CustomerPublic] {
    let profileKey = callerProfileKey(userStore, caller);
    store.entries()
      .filter(func((_id, c)) { c.profile_key == profileKey })
      .map(func((_id, c) : (Common.CustomerId, CustomerTypes.Customer)) : CustomerTypes.CustomerPublic { toPublic(c) })
      .toArray()
  };

  public func getCustomer(store : CustomerStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId, id : Common.CustomerId) : ?CustomerTypes.CustomerPublic {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case (?c) {
        if (c.profile_key != profileKey) null
        else ?toPublic(c)
      };
      case null null;
    }
  };

  /// Fuzzy duplicate detection: returns similar customers by name
  public func checkDuplicate(store : CustomerStore, profile_key : Common.ProfileKey, name : Text) : CustomerTypes.DuplicateCheckResult {
    let similar = store.entries()
      .filter(func((_id, c)) { c.profile_key == profile_key and isSimilar(c.name, name) })
      .map(func((_id, c) : (Common.CustomerId, CustomerTypes.Customer)) : CustomerTypes.CustomerPublic { toPublic(c) })
      .toArray();
    {
      has_similar = similar.size() > 0;
      similar_customers = similar;
    }
  };

  public func createCustomer(
    store : CustomerStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextId : Nat,
    input : CustomerTypes.CustomerInput,
  ) : Common.CustomerId {
    let profileKey = callerProfileKey(userStore, caller);
    let now = Time.now();
    let customer : CustomerTypes.Customer = {
      id = nextId;
      profile_key = profileKey;
      name = input.name;
      phone = input.phone;
      email = input.email;
      address = input.address;
      created_at = now;
      total_sales = 0;
      last_purchase_at = 0;
      lifetime_revenue = 0.0;
      discount_applicable = input.discount_applicable;
      discount_value = input.discount_value;
      notes = switch (input.note) {
        case (?n) [n];
        case null [];
      };
      date_of_birth = input.date_of_birth;
      gender = input.gender;
      // Who-columns: auto-populated from caller principal and current time
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextId, customer);
    nextId
  };

  public func updateCustomer(
    store : CustomerStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Common.CustomerId,
    input : CustomerTypes.CustomerInput,
  ) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    // Allow #admin, #staff, and #superAdmin to update customers
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #admin and up.role != #staff and up.role != #superAdmin) return false;
      };
      case null return false;
    };
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        // Append note if provided — notes array grows over time (append-only)
        let updatedNotes = switch (input.note) {
          case (?n) existing.notes.concat([n]);
          case null existing.notes;
        };
        let now = Time.now();
        store.add(id, {
          existing with
          name = input.name;
          phone = input.phone;
          email = input.email;
          address = input.address;
          discount_applicable = input.discount_applicable;
          discount_value = input.discount_value;
          notes = updatedNotes;
          date_of_birth = input.date_of_birth;
          gender = input.gender;
          // Who-columns: last_updated_by and last_update_date updated; created_by and creation_date preserved
          last_updated_by = caller;
          last_update_date = now;
        });
        true
      };
    }
  };

  public func deleteCustomer(store : CustomerStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId, id : Common.CustomerId) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        store.remove(id);
        true
      };
    }
  };

  /// Called after a sale completes — bumps total_sales by saleCountDelta, updates lifetime_revenue by revenueDelta.
  public func recordSale(store : CustomerStore, id : Common.CustomerId, revenue : Float, timestamp : Common.Timestamp) {
    switch (store.get(id)) {
      case null {};
      case (?existing) {
        store.add(id, {
          existing with
          total_sales = existing.total_sales + 1;
          last_purchase_at = timestamp;
          lifetime_revenue = existing.lifetime_revenue + revenue;
          last_update_date = timestamp;
        });
      };
    }
  };

  /// Called after an order is edited — adjusts lifetime_revenue by revenueDelta (can be negative)
  public func adjustRevenue(store : CustomerStore, id : Common.CustomerId, revenueDelta : Float, timestamp : Common.Timestamp) {
    switch (store.get(id)) {
      case null {};
      case (?existing) {
        store.add(id, {
          existing with
          lifetime_revenue = existing.lifetime_revenue + revenueDelta;
          last_update_date = timestamp;
        });
      };
    }
  };

  // ── Body Composition History ───────────────────────────────────────────────

  /// Create a body composition entry for a customer.
  /// Uses Time.now() as a unique ID suffix to avoid collisions.
  public func createBodyCompositionEntry(
    bcStore : BodyCompositionStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
    input : CustomerTypes.BodyCompositionInput,
  ) : ?CustomerTypes.BodyCompositionEntry {
    let profileKey = callerProfileKey(userStore, caller);
    let now = Time.now();
    let callerText = caller.toText();
    // Generate a unique ID from timestamp + caller principal size
    let idSuffix = callerText.size() % 26;
    let id = now.toText() # "_" # idSuffix.toText() # "_" # customerId.toText();
    let entry : CustomerTypes.BodyCompositionEntry = {
      id;
      customer_id = customerId.toText();
      profile_key = profileKey;
      date = input.date;
      weight = input.weight;
      body_fat = input.body_fat;
      visceral_fat = input.visceral_fat;
      bmr = input.bmr;
      bmi = input.bmi;
      body_age = input.body_age;
      trunk_fat = input.trunk_fat;
      muscle_mass = input.muscle_mass;
      created_by = callerText;
      creation_date = now;
    };
    bcStore.add(id, entry);
    ?entry
  };

  /// Returns body composition history for a customer, sorted by date descending.
  public func getBodyCompositionHistory(
    bcStore : BodyCompositionStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
  ) : [CustomerTypes.BodyCompositionEntry] {
    let profileKey = callerProfileKey(userStore, caller);
    let custIdText = customerId.toText();
    let entries = bcStore.entries()
      .filter(func((_id, e)) {
        e.profile_key == profileKey and e.customer_id == custIdText
      })
      .map(func((_id, e) : (Text, CustomerTypes.BodyCompositionEntry)) : CustomerTypes.BodyCompositionEntry { e })
      .toArray();
    // Sort by creation_date descending (newest first)
    entries.sort(func(a, b) {
      if (a.creation_date > b.creation_date) #less
      else if (a.creation_date < b.creation_date) #greater
      else #equal
    })
  };

  /// Delete a body composition entry — checks it belongs to caller's profile.
  public func deleteBodyCompositionEntry(
    bcStore : BodyCompositionStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Text,
  ) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (bcStore.get(id)) {
      case null false;
      case (?entry) {
        if (entry.profile_key != profileKey) return false;
        bcStore.remove(id);
        true
      };
    }
  };
};
