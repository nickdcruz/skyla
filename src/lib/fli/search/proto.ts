// v1.1
/**
 * Minimal protobuf encoder for the GetBookingResults token and tfs deep-link parameter.
 *
 * 1:1 port of fli/search/_proto.py — preserves the byte-perfect
 * reproduction of a captured live booking token.
 */

import { Buffer } from "node:buffer";

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function varint(value: number): Uint8Array {
  if (value < 0) throw new Error("varint encoder takes non-negative ints only");
  const bytes: number[] = [];
  let v = value;
  while (true) {
    const byte = v & 0x7f;
    v >>>= 7;
    if (v > 0) {
      bytes.push(byte | 0x80);
    } else {
      bytes.push(byte);
      break;
    }
  }
  return new Uint8Array(bytes);
}

function tag(field: number, wire: number): Uint8Array {
  return varint((field << 3) | wire);
}

function lengthDelim(field: number, payload: Uint8Array): Uint8Array {
  return concatBytes(tag(field, 2), varint(payload.length), payload);
}

function varintField(field: number, value: number): Uint8Array {
  return concatBytes(tag(field, 0), varint(value));
}

function base64Encode(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i] as number);
  return btoa(binary);
}

const utf8 = new TextEncoder();

/**
 * Construct the GetBookingResults outer[0][1] token.
 */
export function buildBookingToken(args: {
  sessionId: string;
  airlineCode: string;
  flightNumber: string;
  legIndex: number;
  priceCents: number;
  currency?: string;
}): string {
  const { sessionId, airlineCode, flightNumber, legIndex, priceCents } = args;
  const currency = args.currency ?? "USD";

  if (priceCents < 0) throw new Error("price_cents must be non-negative");
  if (!sessionId) throw new Error("session_id must be non-empty");
  if (!airlineCode) throw new Error("airline_code must be non-empty");
  if (!flightNumber) throw new Error("flight_number must be non-empty");
  if (!currency) throw new Error("currency must be non-empty");

  const nested = concatBytes(
    varintField(1, priceCents),
    varintField(2, 2),
    lengthDelim(3, utf8.encode(currency)),
  );

  const payload = concatBytes(
    lengthDelim(1, utf8.encode(sessionId)),
    lengthDelim(2, utf8.encode(`${airlineCode}${flightNumber}#${legIndex}`)),
    lengthDelim(3, nested),
    varintField(7, 28),
    varintField(14, priceCents),
  );

  return base64Encode(payload);
}

/**
 * Encode a non-negative BigInt as a protobuf varint.
 */
function varintBig(value: bigint): Uint8Array {
  if (value < 0n) throw new Error("varint encoder takes non-negative ints only");
  const bytes: number[] = [];
  let v = value;
  while (true) {
    const byte = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) {
      bytes.push(byte | 0x80);
    } else {
      bytes.push(byte);
      break;
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Encode bytes as URL-safe base64 without `=` padding.
 */
function toUrlsafeB64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64url");
  }
  return base64Encode(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** One physical leg within a booking-URL segment. */
export interface LegSpec {
  origin: string;
  depDate: string;
  dest: string;
  airline: string;
  flightNumber: string;
}

export interface BuildTfsTokenOptions {
  isOneWay?: boolean;
}

/**
 * Build the `tfs` query parameter for a Google Flights deep-link URL.
 *
 * 1:1 port of fli/search/_proto.py::build_tfs_token.
 */
export function buildTfsToken(segments: LegSpec[][], options: BuildTfsTokenOptions = {}): string {
  const isOneWay = options.isOneWay ?? true;
  if (segments.length === 0) throw new Error("segments must be non-empty");
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg || seg.length === 0) throw new Error(`segment ${i} has no legs`);
  }

  let segmentProtos: Uint8Array = new Uint8Array(0);
  for (const seg of segments) {
    let legsProto: Uint8Array = new Uint8Array(0);
    for (const leg of seg) {
      const legProto = concatBytes(
        lengthDelim(1, utf8.encode(leg.origin)),
        lengthDelim(2, utf8.encode(leg.depDate)),
        lengthDelim(3, utf8.encode(leg.dest)),
        lengthDelim(5, utf8.encode(leg.airline)),
        lengthDelim(6, utf8.encode(leg.flightNumber)),
      );
      legsProto = concatBytes(legsProto, lengthDelim(4, legProto));
    }

    const first = seg[0] as LegSpec;
    const last = seg[seg.length - 1] as LegSpec;
    const segProto = concatBytes(
      lengthDelim(2, utf8.encode(first.depDate)),
      legsProto,
      lengthDelim(13, concatBytes(varintField(1, 1), lengthDelim(2, utf8.encode(first.origin)))),
      lengthDelim(14, concatBytes(varintField(1, 1), lengthDelim(2, utf8.encode(last.dest)))),
    );
    segmentProtos = concatBytes(segmentProtos, lengthDelim(3, segProto));
  }

  const MAX_U64 = (1n << 64n) - 1n;
  const f19 = isOneWay ? 2 : 1;

  const payload = concatBytes(
    varintField(1, 28),
    varintField(2, 2),
    segmentProtos,
    varintField(8, 1),
    varintField(9, 1),
    varintField(14, 1),
    lengthDelim(16, concatBytes(tag(1, 0), varintBig(MAX_U64))),
    varintField(19, f19),
  );
  return toUrlsafeB64(payload);
}
