import { facebookSource } from "./facebook";
import { craigslistSource } from "./craigslist";
import { offerupSource } from "./offerup";
import { carsComSource } from "./cars-com";
import { cargurusSource } from "./cargurus";
import { autotraderSource } from "./autotrader";
import { swoopaSource } from "./swoopa";
import type { MarketSource } from "./types";

export const MARKET_SOURCES: MarketSource[] = [
  facebookSource,
  craigslistSource,
  offerupSource,
  carsComSource,
  cargurusSource,
  autotraderSource,
  swoopaSource,
];

export * from "./types";
