import { Networks, xdr, SorobanDataBuilder } from "@stellar/stellar-sdk";

const builder = new SorobanDataBuilder();
const data = builder.build();
const resources = data.resources();
console.log("Resources type:", typeof resources);
console.log("Resources keys:", Object.keys(Object.getPrototypeOf(resources)));
console.log("Resources:", resources);
