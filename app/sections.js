// Report sections, mirroring the SM&E PCA report (ASTM E2018-24) structure, in report order.
export const SECTIONS = [
  { id: "photo", title: "General Views (building elevations, site)" },
  { id: "3.1", title: "Parcel Configuration" },
  { id: "3.2.1", title: "Topography" },
  { id: "3.2.2", title: "Storm Water Drainage" },
  { id: "3.2.3", title: "Ingress and Egress" },
  { id: "3.2.4", title: "Paving, Curbing, and Parking" },
  { id: "3.2.5", title: "Walkways, Grade-Level Steps, and Ramps" },
  { id: "3.2.6", title: "Landscaping and Irrigation" },
  { id: "3.2.7", title: "Retaining Walls" },
  { id: "3.2.8", title: "Site and Building Signage" },
  { id: "3.2.9", title: "Perimeter Walls, Gates, and Fences" },
  { id: "3.2.10", title: "Site Amenities" },
  { id: "3.2.11", title: "Special Utility Systems" },
  { id: "3.2.12", title: "Utility Service Providers" },
  { id: "4.1", title: "Foundation/Substructure" },
  { id: "4.2", title: "Building Frame" },
  { id: "4.3.1", title: "Exterior Walls" },
  { id: "4.3.2", title: "Doors, Windows, & Dock Doors" },
  { id: "4.4.1", title: "Roofing Materials" },
  { id: "5.1", title: "Plumbing, Domestic Hot Water, and Sewer Systems" },
  { id: "5.2", title: "Heating, Air Conditioning, and Ventilation" },
  { id: "5.3", title: "Electrical" },
  { id: "5.4", title: "Lighting" },
  { id: "5.5", title: "Vertical Transportation" },
  { id: "5.6.1", title: "Fire Suppression Systems" },
  { id: "6.1", title: "Interior Elements" },
  { id: "7.1", title: "ADA Accessibility Assessment" },
  { id: "8", title: "Suspect Water Intrusion and Microbial Growth" },
  { id: "9", title: "Natural Hazard Information" },
  { id: "2.2", title: "Property Personnel Interviewed/Contacted" },
];

export const sectionTitle = id => (SECTIONS.find(s => s.id === id) || {}).title || id;
export const sectionOrder = id => {
  const i = SECTIONS.findIndex(s => s.id === id);
  return i < 0 ? SECTIONS.length : i;
};
export const sectionLabel = id => (id === "photo" ? sectionTitle(id) : `${id} ${sectionTitle(id)}`);

export function groupOf(id) {
  if (id === "photo") return "General";
  if (id.startsWith("3.")) return "Site";
  if (id.startsWith("4.")) return "Structure and Roof";
  if (id.startsWith("5.")) return "Mechanical, Electrical, Fire";
  return "Interior and Other";
}
