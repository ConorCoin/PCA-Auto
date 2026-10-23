// Report details the assessor can fill in (any of it can stay blank and be completed later in Word).
// k = storage key, l = label, ph = example shown in the empty box, area = multi-line, def = default value.
export const GROUPS = [
  {
    title: "Cover letter and client",
    fields: [
      { k: "reportDate", l: "Report date", ph: "August 7, 2026" },
      { k: "inspectionDate", l: "Inspection date", ph: "6.19.26" },
      { k: "clientContact", l: "Client contact", ph: "Mr. Lamont Williams" },
      { k: "clientTitle", l: "Contact title", ph: "Manager, Corporate Development" },
      { k: "clientCompany", l: "Client company", ph: "Group 1 Realty, Inc." },
      { k: "clientAddr1", l: "Client street address", ph: "730 Town & Country Blvd., Suite 500" },
      { k: "clientAddr2", l: "Client city, state, zip", ph: "Houston, Texas 77024" },
      { k: "inspectorName", l: "Inspector name", ph: "Kenneth Moore" },
      { k: "inspectorTitle", l: "Inspector title", ph: "Project Engineer/Inspector" },
      { k: "inspectorPhone", l: "Inspector phone", ph: "(770) 653-4891" },
    ],
  },
  {
    title: "Property data",
    fields: [
      { k: "use", l: "Property use", ph: "Automotive Dealership" },
      { k: "acreage", l: "Land acreage (acres)", ph: "7" },
      { k: "numBuildings", l: "Number of buildings", ph: "Two buildings" },
      { k: "floors", l: "Number of floors", ph: "Three" },
      { k: "yearBuilt", l: "Year built", ph: "2024" },
      { k: "grossArea", l: "Gross building area (SF), as printed", ph: "~60,694 SF for the dealership & ~5,040 SF for the detail building" },
      { k: "sfNumber", l: "Total building SF (number, for cost per SF)", ph: "65734" },
      { k: "foundation", l: "Foundation/Substructure", ph: "Concrete slab-on-grade with perimeter and interior footings", area: true },
      { k: "superstructure", l: "Superstructure", ph: "I-Beam construction with steel supports and steel decking", area: true },
      { k: "facade", l: "Facade", ph: "Smooth metal decorative panels and corrugated steel panels", area: true },
      { k: "roofType", l: "Roof type", ph: "TPO on the dealership & standing seam metal on the detail building", area: true },
      { k: "parkingArea", l: "Parking area", ph: "Asphalt paving & concrete" },
      { k: "parkingCount", l: "Parking space count", ph: "Three hundred seventy-one (371)" },
      { k: "adaParking", l: "ADA-designated parking count", ph: "Six (6)" },
      { k: "hvac", l: "HVAC system", ph: "Thirteen (13) roof mounted units" },
      { k: "waterPiping", l: "Water supply piping", ph: "Copper" },
      { k: "wiring", l: "Electrical branch wiring", ph: "Copper" },
      { k: "elevators", l: "Number of elevators", ph: "One" },
      { k: "fireSuppression", l: "Fire suppression", ph: "Wet-type fire suppression throughout" },
      { k: "fireAlarm", l: "Fire alarm", ph: "Honeywell Fire Control Panel" },
    ],
  },
  {
    title: "Buildings table",
    fields: [
      { k: "b1Name", l: "Building 1 name", ph: "Automotive Dealership" },
      { k: "b1Area", l: "Building 1 area (SF)", ph: "~60,694" },
      { k: "b1Year", l: "Building 1 construction date", ph: "2024" },
      { k: "b2Name", l: "Building 2 name", ph: "Detail Building" },
      { k: "b2Area", l: "Building 2 area (SF)", ph: "~5,040" },
      { k: "b2Year", l: "Building 2 construction date", ph: "2024" },
      { k: "b3Name", l: "Building 3 name", ph: "" },
      { k: "b3Area", l: "Building 3 area (SF)", ph: "" },
      { k: "b3Year", l: "Building 3 construction date", ph: "" },
    ],
  },
  {
    title: "Executive summary wording",
    fields: [
      { k: "overall", l: "Overall General Condition", ph: "Based on the systems and components observed during the site visit, the subject property appeared to be in good condition...", area: true },
      { k: "maintenance", l: "Level of Preventative Maintenance", ph: "", area: true },
      { k: "deferred", l: "Significant Deferred Maintenance Items (>$3,000)", ph: "", area: true },
      { k: "pending", l: "Significant Pending or In-Progress Capital Improvements (>$25,000)", ph: "", area: true },
      { k: "completed", l: "Significant Recently Completed Capital Improvements (>$25,000)", ph: "", area: true },
      { k: "investigations", l: "Recommendations of Additional Investigations", ph: "No recommended additional investigations.", area: true, def: "No recommended additional investigations." },
    ],
  },
  {
    title: "Cost settings",
    fields: [
      { k: "term", l: "Evaluation term (years)", ph: "10", def: "10" },
      { k: "inflation", l: "Inflation factor (%)", ph: "3", def: "3" },
    ],
  },
];

export const DEFAULTS = Object.fromEntries(GROUPS.flatMap(g => g.fields).filter(f => f.def !== undefined).map(f => [f.k, f.def]));
