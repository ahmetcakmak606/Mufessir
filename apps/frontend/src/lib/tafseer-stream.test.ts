import { afterEach, describe, expect, it, vi } from "vitest";
import { startTafseerStream, type StreamEvent } from "@/lib/tafseer";

// Canlıda görülen boş ekran: sunucu akış yerine düz JSON döndüğünde istemci
// yanıtı sessizce atlıyordu. Bu testler istemcinin her durumda kullanıcıya
// bir sonuç (complete) veya hata (error) olayı verdiğini doğrular.

function sseResponse(chunks: string[]): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

async function collect(res: Response): Promise<StreamEvent[]> {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(res));
  const events: StreamEvent[] = [];
  await startTafseerStream({ verseId: "v" }, "token", (e) => events.push(e));
  return events;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("startTafseerStream: boş ekran kalmaz", () => {
  it("akış yerine gelen düz JSON'u tamamlanmış yanıt olarak işler", async () => {
    const res = new Response(
      JSON.stringify({
        aiResponse: "",
        noTafsirForSelectedScholars: true,
        noTafsirMessage: "Seçilen alimlerin bu ayet için tefsiri bulunmamaktadır.",
        missingScholarNames: ["A"],
      }),
      { status: 200, headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
    const events = await collect(res);
    expect(events.map((e) => e.type)).toEqual(["start", "complete"]);
    expect(events[1]).toMatchObject({
      noTafsirForSelectedScholars: true,
      missingScholarNames: ["A"],
    });
  });

  it("çözülemeyen JSON gövdesinde hata olayı verir", async () => {
    const res = new Response("{bozuk", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const events = await collect(res);
    expect(events.map((e) => e.type)).toEqual(["error"]);
  });

  it("complete veya error olmadan biten akışta hata olayı verir", async () => {
    const events = await collect(sseResponse(['data: {"type":"start"}\n\n']));
    expect(events.map((e) => e.type)).toEqual(["start", "error"]);
  });

  it("normal akışta fazladan hata olayı üretmez", async () => {
    const events = await collect(
      sseResponse([
        'data: {"type":"start"}\n\n',
        'data: {"type":"chunk","content":"x"}\n\n',
        'data: {"type":"complete"}\n\n',
      ]),
    );
    expect(events.map((e) => e.type)).toEqual(["start", "chunk", "complete"]);
  });
});

import {
  DEFAULT_SCHOLAR_IDS,
  MAX_SELECTED_SCHOLARS,
  clampReplayScholars,
  defaultScholarSelection,
} from "@/lib/tafseer";

describe("müfessir seçim kuralı (18 Kas)", () => {
  it("varsayılan beşli: Taberî, Mâtürîdî, Zemahşerî, Râzî, İbn Kesîr", () => {
    expect(DEFAULT_SCHOLAR_IDS).toEqual(["7", "9", "19", "22", "29"]);
    expect(MAX_SELECTED_SCHOLARS).toBe(5);
  });

  it("varsayılandan yalnız mevcut listede olanları seçer", () => {
    expect(defaultScholarSelection(["7", "19", "100"])).toEqual(["7", "19"]);
    expect(defaultScholarSelection()).toEqual(["7", "9", "19", "22", "29"]);
  });

  it("5'ten fazla müfessirli eski kaydı varsayılana döndürür ve bunu bildirir", () => {
    const many = ["1", "2", "3", "4", "5", "6"];
    expect(clampReplayScholars(many)).toEqual({
      scholars: ["7", "9", "19", "22", "29"],
      replacedWithDefaults: true,
    });
    expect(clampReplayScholars(["1", "2"])).toEqual({
      scholars: ["1", "2"],
      replacedWithDefaults: false,
    });
  });
});
