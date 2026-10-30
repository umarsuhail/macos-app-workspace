export const families = ["Nielsen", "Kahnwald", "Doppler", "Tiedemann"] as const;
export type Family = string;
export type Person = { id: string; name: string; family: Family; role: string; description: string };

// Opening family relationships. Deliberately excludes later time-travel revelations.
// Portraits are supplied by the user; no external image requests are made.
export const people: Person[] = [
  { id: "ulrich", name: "Ulrich Nielsen", family: "Nielsen", role: "Parent", description: "A Winden police officer. Married to Katharina; father of Magnus, Martha, and Mikkel." },
  { id: "katharina", name: "Katharina Nielsen", family: "Nielsen", role: "Parent", description: "The school principal. Married to Ulrich; mother of Magnus, Martha, and Mikkel." },
  { id: "magnus", name: "Magnus Nielsen", family: "Nielsen", role: "Child", description: "The eldest of the three Nielsen children. Brother of Martha and Mikkel." },
  { id: "martha", name: "Martha Nielsen", family: "Nielsen", role: "Child", description: "Daughter of Ulrich and Katharina, and sister of Magnus and Mikkel." },
  { id: "mikkel", name: "Mikkel Nielsen", family: "Nielsen", role: "Child", description: "The youngest Nielsen child, with an interest in magic." },
  { id: "michael", name: "Michael Kahnwald", family: "Kahnwald", role: "Parent", description: "An artist, Hannah’s husband, and Jonas’s father." },
  { id: "hannah", name: "Hannah Kahnwald", family: "Kahnwald", role: "Parent", description: "Jonas’s mother and Michael’s wife. She works as a massage therapist in Winden." },
  { id: "jonas", name: "Jonas Kahnwald", family: "Kahnwald", role: "Child", description: "The son of Hannah and Michael Kahnwald. A student at Winden’s school." },
  { id: "peter", name: "Peter Doppler", family: "Doppler", role: "Parent", description: "A therapist, Charlotte’s husband, and father of Franziska and Elisabeth." },
  { id: "charlotte", name: "Charlotte Doppler", family: "Doppler", role: "Parent", description: "Winden’s police chief. Married to Peter; mother of Franziska and Elisabeth." },
  { id: "franziska", name: "Franziska Doppler", family: "Doppler", role: "Child", description: "Peter and Charlotte’s elder daughter, and Elisabeth’s sister." },
  { id: "elisabeth", name: "Elisabeth Doppler", family: "Doppler", role: "Child", description: "The younger daughter of Peter and Charlotte Doppler. Sister of Franziska." },
  { id: "aleksander", name: "Aleksander Tiedemann", family: "Tiedemann", role: "Parent", description: "Director of Winden’s nuclear power plant, Regina’s husband, and Bartosz’s father." },
  { id: "regina", name: "Regina Tiedemann", family: "Tiedemann", role: "Parent", description: "The owner of Winden’s hotel. Married to Aleksander; mother of Bartosz." },
  { id: "bartosz", name: "Bartosz Tiedemann", family: "Tiedemann", role: "Child", description: "The son of Regina and Aleksander Tiedemann, and a school friend of Jonas." },
];

export const households: Record<Family, { parents: [string, string]; children: string[] }> = {
  Nielsen: { parents: ["ulrich", "katharina"], children: ["magnus", "martha", "mikkel"] },
  Kahnwald: { parents: ["michael", "hannah"], children: ["jonas"] },
  Doppler: { parents: ["peter", "charlotte"], children: ["franziska", "elisabeth"] },
  Tiedemann: { parents: ["aleksander", "regina"], children: ["bartosz"] },
};
export const byId = Object.fromEntries(people.map(person => [person.id, person]));

export function relatives(id: string) {
  const home = households[byId[id].family];
  return home.parents.includes(id)
    ? [{ id: home.parents.find(parent => parent !== id)!, relation: "Partner" }, ...home.children.map(child => ({ id: child, relation: "Child" }))]
    : [...home.parents.map(parent => ({ id: parent, relation: "Parent" })), ...home.children.filter(child => child !== id).map(child => ({ id: child, relation: "Sibling" }))];
}
