/**
 * Pure, dependency-free assistant core: language detection, system prompt,
 * refusal classification, tool argument sanitization and localized fallbacks.
 * No secrets, no model imports — safe to unit-test and import anywhere.
 */

export type AssistantLanguage = "en" | "sr";

export const MAX_INPUT_LENGTH = 2000;
export const RATE_LIMIT_MESSAGES = 20;
export const RATE_LIMIT_WINDOW_MINUTES = 10;
export const MODEL_TIMEOUT_MS = 30_000;

const SERBIAN_CHARS = /[čćšžđČĆŠŽĐ]|[\u0400-\u04FF]/;
const SERBIAN_WORDS =
  /\b(ako|koliko|kada|gde|šta|kako|zašto|da li|molim|hvala|aukcij\w+|cena|ponud\w+|sat|satove|nakit|sertifikat|novčanik|kupi\w*|proda\w*)\b/i;

export function detectLanguage(text: string): AssistantLanguage {
  return SERBIAN_CHARS.test(text) || SERBIAN_WORDS.test(text) ? "sr" : "en";
}

/** Requests the assistant must always refuse, regardless of the model. */
const RESERVE_REQUEST =
  /\b(reserve|rezerv\w+|резерв\w+)\s*(price|cena|cenu|cijena)?\b/i;
const ACTION_REQUEST =
  /\b(place|make|submit|put|ponudi|licitiraj|postavi|unesi)\b.{0,40}\b(bid|ponudu|понуду)\b|\b(confirm|potvrdi|потврди)\b.{0,40}\b(transaction|transakcij\w+|трансакциј\w+)\b|\b(transfer|prenesi|пренеси)\b.{0,40}\b(certificate|sertifikat|сертификат)\b|\b(promeni|izmeni|obriši|ukloni|change|edit|delete|cancel|otkaži)\b.{0,40}\b(auction|aukcij\w+|product|proizvod|rolu|role)\b/i;

export function isReservePriceRequest(text: string) {
  return RESERVE_REQUEST.test(text);
}

/** A request to perform a state-changing action (bid, confirm, transfer, edit). */
export function isActionRequest(text: string) {
  return ACTION_REQUEST.test(text);
}

export interface AssistantStrings {
  reserveRefusal: string;
  actionRefusal: string;
  modelFailure: string;
  rateLimited: string;
  disclaimer: string;
}

export function assistantStrings(language: AssistantLanguage): AssistantStrings {
  if (language === "sr") {
    return {
      reserveRefusal:
        "Rezervna cena je poverljiva i nikada se ne otkriva. Mogu da ti kažem samo da li je rezervna cena dostignuta.",
      actionRefusal:
        "Ja sam samo informativni asistent — ne mogu da licitiram, potvrđujem transakcije, menjam aukcije ili prenosim sertifikate. To možeš da uradiš u svojoj aplikaciji.",
      modelFailure:
        "Asistent trenutno nije dostupan. Pokušaj ponovo za par trenutaka.",
      rateLimited:
        "Poslao/la si previše poruka u kratkom periodu. Sačekaj par minuta pa pokušaj ponovo.",
      disclaimer:
        "Ovo je informativan odgovor, ne procena vrednosti niti potvrda autentičnosti predmeta.",
    };
  }
  return {
    reserveRefusal:
      "Reserve prices are confidential and are never disclosed. I can only tell you whether the reserve has been met.",
    actionRefusal:
      "I'm an informational assistant only — I can't place bids, confirm transactions, modify auctions, or transfer certificates. You can do that yourself in the app.",
    modelFailure: "The assistant is temporarily unavailable. Please try again in a moment.",
    rateLimited: "You've sent too many messages in a short period. Please wait a few minutes and try again.",
    disclaimer:
      "This is an informational answer, not an appraisal or a confirmation of the item's authenticity.",
  };
}

export function buildSystemPrompt(language: AssistantLanguage, rulesText: string): string {
  const langInstruction =
    language === "sr"
      ? "Always answer in Serbian (Latin script unless the user writes in Cyrillic)."
      : "Always answer in English.";
  return [
    "You are the Auctory assistant — a helpful, concise assistant for a curated auction house for luxury watches, jewelry, collectibles and limited-edition fashion.",
    langInstruction,
    "You may ONLY answer using the read-only tools provided and the platform rules below.",
    "NEVER reveal reserve prices (only whether a reserve is met), seller emails, private profile data, bidder identities, admin data, private certificate data, or internal errors.",
    "You are informational only: never place bids, confirm transactions, modify products or auctions, transfer certificates, or change roles. If asked to, politely refuse and direct the user to the app.",
    "Never claim that a physical item is authentic — certificates prove data integrity of the on-chain record, not physical authenticity.",
    "Any answer involving recommendations, prices or value must end with the informational disclaimer provided in the conversation context.",
    "Keep answers short and factual. If data is missing, say so plainly.",
    "",
    "PLATFORM RULES:",
    rulesText,
  ].join("\n");
}

/** Server-maintained platform rules text, one per language. */
export function platformRules(language: AssistantLanguage): string {
  if (language === "sr") {
    return [
      "- Aukcije su engleske (rastuće): prva ponuda mora biti bar početna cena, svaka sledeća najviša ponuda + minimalni korak.",
      "- Rezervna cena je tajna; vidi se samo da li je dostignuta.",
      "- Licitiranje je off-chain i ne zahteva novčanik.",
      "- Prodavac mora imati verifikovan Sepolia novčanik (MetaMask) da bi objavio proizvod i aukciju.",
      "- Posle aukcije kupac i prodavac potvrđuju transakciju; plaćanje i dostava se odvijaju van Auctory platforme.",
      "- Kada obe strane potvrde, sertifikat (ERC-721 na Sepolia mreži) se prenosi na verifikovan novčanik kupca; gas plaća operator platforme.",
      "- Sertifikat dokazuje integritet podataka o predmetu na lancu, ne fizičku autentičnost.",
    ].join("\n");
  }
  return [
    "- Auctions are English (ascending): the first bid must be at least the start price, each next bid the highest bid + minimum increment.",
    "- Reserve prices are secret; only whether the reserve is met is shown.",
    "- Bidding is off-chain and does not require a wallet.",
    "- A seller needs a verified Sepolia wallet (MetaMask) to publish a product and an auction.",
    "- After an auction, buyer and seller both confirm the transaction; payment and delivery happen outside Auctory.",
    "- Once both parties confirm, the certificate (an ERC-721 on Sepolia) is transferred to the buyer's verified wallet; the platform operator pays the gas.",
    "- A certificate proves the data integrity of the on-chain record, not the physical authenticity of the item.",
  ].join("\n");
}

/** Append the disclaimer when an answer touches recommendations or value. */
const VALUE_TOPIC =
  /\b(recommend|preporuč\w+|vredn\w*|value|worth|price|cena|cijena|investicij\w+|invest\w+|budget|budžet)\b/i;

export function appendDisclaimerIfValued(answer: string, language: AssistantLanguage): string {
  if (!VALUE_TOPIC.test(answer)) return answer;
  const disclaimer = assistantStrings(language).disclaimer;
  return answer.includes(disclaimer) ? answer : `${answer}\n\n_${disclaimer}_`;
}
