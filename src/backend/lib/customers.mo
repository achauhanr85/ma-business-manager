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
      height = c.height;
      age = c.age;
      address_line1 = c.address_line1;
      address_line2 = c.address_line2;
      state = c.state;
      city = c.city;
      country = c.country;
      pin_code = c.pin_code;
      customer_created_by = c.customer_created_by;
      referred_by = c.referred_by;
      referral_commission_amount = c.referral_commission_amount;
      customer_type = c.customer_type;
      lead_follow_up_date = c.lead_follow_up_date;
      lead_notes = c.lead_notes;
      primary_goal_ids = c.primary_goal_ids;
      medical_issue_ids = c.medical_issue_ids;
      lead_to_active_datetime = c.lead_to_active_datetime;
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
    let callerText = caller.toText();
    // customer_created_by: use provided value if present, otherwise null (frontend shows caller)
    let effectiveCreatedBy : ?Common.UserId = switch (input.customer_created_by) {
      case (?p) ?p;
      case null null;
    };
    // Build initial notes array: support structured notes input
    let initialNotes : [CustomerTypes.CustomerNote] = switch (input.notes) {
      case (?noteInputs) {
        var noteId : Nat = 1;
        noteInputs.map<CustomerTypes.CustomerNoteInput, CustomerTypes.CustomerNote>(func(ni) {
          let n : CustomerTypes.CustomerNote = {
            id = noteId;
            text = ni.text;
            note_date = ni.note_date;
            created_by = callerText;
            creation_date = now;
          };
          noteId += 1;
          n
        })
      };
      case null {
        // Legacy single-note compat
        switch (input.note) {
          case (?n) [{
            id = 1;
            text = n;
            note_date = now;
            created_by = callerText;
            creation_date = now;
          }];
          case null [];
        }
      };
    };
    let customerType = switch (input.customer_type) {
      case (?ct) ct;
      case null #lead;
    };
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
      notes = initialNotes;
      date_of_birth = input.date_of_birth;
      gender = input.gender;
      height = input.height;
      age = input.age;
      address_line1 = input.address_line1;
      address_line2 = input.address_line2;
      state = input.state;
      city = input.city;
      country = input.country;
      pin_code = input.pin_code;
      customer_created_by = effectiveCreatedBy;
      referred_by = input.referred_by;
      referral_commission_amount = input.referral_commission_amount;
      customer_type = customerType;
      lead_follow_up_date = input.lead_follow_up_date;
      lead_notes = input.lead_notes;
      primary_goal_ids = switch (input.primary_goal_ids) { case (?ids) ids; case null [] };
      medical_issue_ids = switch (input.medical_issue_ids) { case (?ids) ids; case null [] };
      lead_to_active_datetime = input.lead_to_active_datetime;
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
    let callerRole = switch (userStore.get(caller)) {
      case (?up) up.role;
      case null return false;
    };
    if (callerRole != #admin and callerRole != #staff and callerRole != #superAdmin) return false;
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        // Append legacy single-note if provided — notes array grows over time (append-only via this path)
        let updatedNotes = switch (input.note) {
          case (?n) {
            let now = Time.now();
            let newNote : CustomerTypes.CustomerNote = {
              id = existing.notes.size() + 1;
              text = n;
              note_date = now;
              created_by = caller.toText();
              creation_date = now;
            };
            existing.notes.concat([newNote])
          };
          case null existing.notes;
        };
        let now = Time.now();
        // Admin/Staff may update customer_created_by
        let updatedCreatedBy : ?Common.UserId = switch (input.customer_created_by) {
          case (?p) ?p;
          case null existing.customer_created_by;
        };
        // Determine new customer_type
        let newCustomerType = switch (input.customer_type) {
          case (?ct) ct;
          case null existing.customer_type;
        };
        // Track lead → active transition datetime
        let newLeadToActiveDatetime : ?Common.Timestamp = switch (existing.customer_type, newCustomerType) {
          case (#lead, #active) ?now;  // Transition happened now
          case _ existing.lead_to_active_datetime; // Preserve existing value
        };
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
          height = input.height;
          age = input.age;
          address_line1 = input.address_line1;
          address_line2 = input.address_line2;
          state = input.state;
          city = input.city;
          country = input.country;
          pin_code = input.pin_code;
          customer_created_by = updatedCreatedBy;
          referred_by = input.referred_by;
          referral_commission_amount = input.referral_commission_amount;
          customer_type = newCustomerType;
          lead_follow_up_date = input.lead_follow_up_date;
          lead_notes = input.lead_notes;
          primary_goal_ids = switch (input.primary_goal_ids) { case (?ids) ids; case null existing.primary_goal_ids };
          medical_issue_ids = switch (input.medical_issue_ids) { case (?ids) ids; case null existing.medical_issue_ids };
          lead_to_active_datetime = newLeadToActiveDatetime;
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

  /// Updates only the customer_type field on a customer record.
  /// Used internally by the notification background job (silent inactivity updates).
  /// Does NOT require a caller — operates directly on the store with profileKey guard.
  public func updateCustomerType(store : CustomerStore, customerId : Common.CustomerId, profileKey : Common.ProfileKey, newType : { #lead; #active; #inactive }) : Bool {
    switch (store.get(customerId)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        let now = Time.now();
        // Track lead → active transition datetime
        let newLeadToActiveDatetime : ?Common.Timestamp = switch (existing.customer_type, newType) {
          case (#lead, #active) ?now;
          case _ existing.lead_to_active_datetime;
        };
        store.add(customerId, {
          existing with
          customer_type = newType;
          lead_to_active_datetime = newLeadToActiveDatetime;
          last_update_date = now;
        });
        true
      };
    }
  };

  /// Called after a sale completes — bumps total_sales by 1, updates lifetime_revenue and last_purchase_at.
  /// Also promotes #lead customers to #active when a sale is made.
  public func recordSale(store : CustomerStore, id : Common.CustomerId, revenue : Float, timestamp : Common.Timestamp) {
    switch (store.get(id)) {
      case null {};
      case (?existing) {
        // Promote lead to active when a sale is made
        let newType = switch (existing.customer_type) {
          case (#lead) #active;
          case other other;
        };
        let newLeadToActiveDatetime : ?Common.Timestamp = switch (existing.customer_type, newType) {
          case (#lead, #active) ?timestamp;
          case _ existing.lead_to_active_datetime;
        };
        store.add(id, {
          existing with
          total_sales = existing.total_sales + 1;
          last_purchase_at = timestamp;
          lifetime_revenue = existing.lifetime_revenue + revenue;
          customer_type = newType;
          lead_to_active_datetime = newLeadToActiveDatetime;
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

  // ── Customer Notes ─────────────────────────────────────────────────────────────

  /// Append a new structured note to a customer's notes array.
  /// Returns the updated customer or null if not found / not in profile.
  public func addCustomerNote(
    store : CustomerStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
    text : Text,
    noteDate : Common.Timestamp,
  ) : ?CustomerTypes.CustomerPublic {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(customerId)) {
      case null null;
      case (?existing) {
        if (existing.profile_key != profileKey) return null;
        let now = Time.now();
        let newNote : CustomerTypes.CustomerNote = {
          id = existing.notes.size() + 1;
          text;
          note_date = noteDate;
          created_by = caller.toText();
          creation_date = now;
        };
        let updatedCustomer : CustomerTypes.Customer = {
          existing with
          notes = existing.notes.concat([newNote]);
          last_updated_by = caller;
          last_update_date = now;
        };
        store.add(customerId, updatedCustomer);
        ?toPublic(updatedCustomer)
      };
    }
  };

  /// Delete a note by its id from a customer's notes array.
  public func deleteCustomerNote(
    store : CustomerStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
    noteId : Nat,
  ) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(customerId)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        let updatedNotes = existing.notes.filter(func(n : CustomerTypes.CustomerNote) : Bool { n.id != noteId });
        let now = Time.now();
        store.add(customerId, {
          existing with
          notes = updatedNotes;
          last_updated_by = caller;
          last_update_date = now;
        });
        true
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
