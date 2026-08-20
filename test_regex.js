const regex = /(?:SF|R)[A-Z0-9]*(?:AJI|NYK)/;
const q1 = "SF12345678AJI";
const q2 = "R12345678AJI";
const q3 = "SF1234NYK";
const q4 = "R9876NYK";
const q5 = "AWB Ref: SF00000000AJI  Shipment: R111111NYK";

console.log(q1.match(regex)[0]);
console.log(q2.match(regex)[0]);
console.log(q3.match(regex)[0]);
console.log(q4.match(regex)[0]);
console.log(q5.replace(/\s+/g, "").toUpperCase().match(regex)[0]);
