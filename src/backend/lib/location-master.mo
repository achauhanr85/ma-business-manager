import Map "mo:core/Map";
import Common "../types/common";

module {
  public type Store = Map.Map<Text, Common.LocationMasterEntry>;

  // ── Read ──────────────────────────────────────────────────────────────────────

  public func getStates(store : Store) : [Common.LocationMasterEntry] {
    store.entries()
      .filter(func((_id, e) : (Text, Common.LocationMasterEntry)) : Bool {
        e.entry_type == "state"
      })
      .map(func((_id, e) : (Text, Common.LocationMasterEntry)) : Common.LocationMasterEntry { e })
      .toArray()
  };

  public func getCitiesByState(store : Store, stateId : Text) : [Common.LocationMasterEntry] {
    store.entries()
      .filter(func((_id, e) : (Text, Common.LocationMasterEntry)) : Bool {
        e.entry_type == "city" and e.parent_id == ?stateId
      })
      .map(func((_id, e) : (Text, Common.LocationMasterEntry)) : Common.LocationMasterEntry { e })
      .toArray()
  };

  public func getCountries(store : Store) : [Common.LocationMasterEntry] {
    store.entries()
      .filter(func((_id, e) : (Text, Common.LocationMasterEntry)) : Bool {
        e.entry_type == "country"
      })
      .map(func((_id, e) : (Text, Common.LocationMasterEntry)) : Common.LocationMasterEntry { e })
      .toArray()
  };

  // ── Write ─────────────────────────────────────────────────────────────────────

  public func addEntry(store : Store, entry : Common.LocationMasterEntry) : Bool {
    store.add(entry.id, entry);
    true
  };

  // ── Seed ──────────────────────────────────────────────────────────────────────

  public func seedIfEmpty(store : Store) {
    if (not store.isEmpty()) return;

    // Country
    store.add("country-india", { id = "country-india"; name = "India"; parent_id = null; entry_type = "country" });

    // States / UTs (28 states + 8 UTs)
    let states : [(Text, Text)] = [
      ("state-ap",  "Andhra Pradesh"),
      ("state-ar",  "Arunachal Pradesh"),
      ("state-as",  "Assam"),
      ("state-br",  "Bihar"),
      ("state-cg",  "Chhattisgarh"),
      ("state-ga",  "Goa"),
      ("state-gj",  "Gujarat"),
      ("state-hr",  "Haryana"),
      ("state-hp",  "Himachal Pradesh"),
      ("state-jh",  "Jharkhand"),
      ("state-ka",  "Karnataka"),
      ("state-kl",  "Kerala"),
      ("state-mp",  "Madhya Pradesh"),
      ("state-mh",  "Maharashtra"),
      ("state-mn",  "Manipur"),
      ("state-ml",  "Meghalaya"),
      ("state-mz",  "Mizoram"),
      ("state-nl",  "Nagaland"),
      ("state-od",  "Odisha"),
      ("state-pb",  "Punjab"),
      ("state-rj",  "Rajasthan"),
      ("state-sk",  "Sikkim"),
      ("state-tn",  "Tamil Nadu"),
      ("state-tg",  "Telangana"),
      ("state-tr",  "Tripura"),
      ("state-up",  "Uttar Pradesh"),
      ("state-ut",  "Uttarakhand"),
      ("state-wb",  "West Bengal"),
      // Union Territories
      ("state-an",  "Andaman and Nicobar Islands"),
      ("state-ch",  "Chandigarh"),
      ("state-dn",  "Dadra and Nagar Haveli and Daman and Diu"),
      ("state-dl",  "Delhi"),
      ("state-jk",  "Jammu and Kashmir"),
      ("state-la",  "Ladakh"),
      ("state-ld",  "Lakshadweep"),
      ("state-py",  "Puducherry"),
    ];
    for ((id, name) in states.values()) {
      store.add(id, { id; name; parent_id = ?"country-india"; entry_type = "state" });
    };

    // Major cities per state
    let cities : [(Text, Text, Text)] = [
      // (city-id, city-name, state-id)
      ("city-hyd",    "Hyderabad",         "state-ap"),
      ("city-viz",    "Visakhapatnam",     "state-ap"),
      ("city-ijk",    "Itanagar",          "state-ar"),
      ("city-guw",    "Guwahati",          "state-as"),
      ("city-dis",    "Dibrugarh",         "state-as"),
      ("city-pat",    "Patna",             "state-br"),
      ("city-gaya",   "Gaya",              "state-br"),
      ("city-rpr",    "Raipur",            "state-cg"),
      ("city-blas",   "Bilaspur",          "state-cg"),
      ("city-pnj",    "Panaji",            "state-ga"),
      ("city-mrg",    "Margao",            "state-ga"),
      ("city-ahm",    "Ahmedabad",         "state-gj"),
      ("city-srt",    "Surat",             "state-gj"),
      ("city-vdr",    "Vadodara",          "state-gj"),
      ("city-raj",    "Rajkot",            "state-gj"),
      ("city-grg",    "Gurugram",          "state-hr"),
      ("city-fbd",    "Faridabad",         "state-hr"),
      ("city-shm",    "Shimla",            "state-hp"),
      ("city-mnl",    "Manali",            "state-hp"),
      ("city-ran",    "Ranchi",            "state-jh"),
      ("city-jsr",    "Jamshedpur",        "state-jh"),
      ("city-blr",    "Bengaluru",         "state-ka"),
      ("city-mys",    "Mysuru",            "state-ka"),
      ("city-hub",    "Hubballi",          "state-ka"),
      ("city-tvm",    "Thiruvananthapuram","state-kl"),
      ("city-koc",    "Kochi",             "state-kl"),
      ("city-kzd",    "Kozhikode",         "state-kl"),
      ("city-bpl",    "Bhopal",            "state-mp"),
      ("city-ind",    "Indore",            "state-mp"),
      ("city-jbl",    "Jabalpur",          "state-mp"),
      ("city-mum",    "Mumbai",            "state-mh"),
      ("city-pun",    "Pune",              "state-mh"),
      ("city-nag",    "Nagpur",            "state-mh"),
      ("city-ths",    "Thane",             "state-mh"),
      ("city-imp",    "Imphal",            "state-mn"),
      ("city-shl",    "Shillong",          "state-ml"),
      ("city-aiz",    "Aizawl",            "state-mz"),
      ("city-koh",    "Kohima",            "state-nl"),
      ("city-bbr",    "Bhubaneswar",       "state-od"),
      ("city-cut",    "Cuttack",           "state-od"),
      ("city-chd",    "Chandigarh",        "state-pb"),
      ("city-lud",    "Ludhiana",          "state-pb"),
      ("city-amt",    "Amritsar",          "state-pb"),
      ("city-jpri",   "Jaipur",            "state-rj"),
      ("city-jod",    "Jodhpur",           "state-rj"),
      ("city-udr",    "Udaipur",           "state-rj"),
      ("city-gtk",    "Gangtok",           "state-sk"),
      ("city-che",    "Chennai",           "state-tn"),
      ("city-coi",    "Coimbatore",        "state-tn"),
      ("city-mdu",    "Madurai",           "state-tn"),
      ("city-hyd2",   "Hyderabad",         "state-tg"),
      ("city-wgl",    "Warangal",          "state-tg"),
      ("city-agl",    "Agartala",          "state-tr"),
      ("city-lko",    "Lucknow",           "state-up"),
      ("city-knp",    "Kanpur",            "state-up"),
      ("city-agr",    "Agra",              "state-up"),
      ("city-var",    "Varanasi",          "state-up"),
      ("city-drd",    "Dehradun",          "state-ut"),
      ("city-hrd",    "Haridwar",          "state-ut"),
      ("city-kol",    "Kolkata",           "state-wb"),
      ("city-hwd",    "Howrah",            "state-wb"),
      ("city-durg",   "Durgapur",          "state-wb"),
      // UTs
      ("city-pbl",    "Port Blair",        "state-an"),
      ("city-chdc",   "Chandigarh City",   "state-ch"),
      ("city-dnd",    "Daman",             "state-dn"),
      ("city-newdl",  "New Delhi",         "state-dl"),
      ("city-sng",    "Srinagar",          "state-jk"),
      ("city-jmu",    "Jammu",             "state-jk"),
      ("city-leh",    "Leh",               "state-la"),
      ("city-kav",    "Kavaratti",         "state-ld"),
      ("city-pon",    "Puducherry",        "state-py"),
    ];
    for ((id, name, stateId) in cities.values()) {
      store.add(id, { id; name; parent_id = ?stateId; entry_type = "city" });
    };
  };
};
