import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTour } from "@/hooks/use-tour";

const STORAGE_KEY = "test_tour_done";

beforeEach(() => localStorage.removeItem(STORAGE_KEY));
afterEach(() => localStorage.removeItem(STORAGE_KEY));

describe("useTour", () => {
  it("inicia inativo com step 0", () => {
    const { result } = renderHook(() => useTour(STORAGE_KEY));
    expect(result.current.active).toBe(false);
    expect(result.current.step).toBe(0);
  });

  it("start() ativa o tour e reseta o step para 0", () => {
    const { result } = renderHook(() => useTour(STORAGE_KEY));
    act(() => result.current.start());
    expect(result.current.active).toBe(true);
    expect(result.current.step).toBe(0);
  });

  it("start(N) ativa o tour no step indicado", () => {
    const { result } = renderHook(() => useTour(STORAGE_KEY));
    act(() => result.current.start(5));
    expect(result.current.active).toBe(true);
    expect(result.current.step).toBe(5);
  });

  it("next() avança o step", () => {
    const { result } = renderHook(() => useTour(STORAGE_KEY));
    act(() => result.current.start());
    act(() => result.current.next(3));
    expect(result.current.step).toBe(1);
  });

  it("next() no último step encerra o tour e grava localStorage", () => {
    const { result } = renderHook(() => useTour(STORAGE_KEY));
    act(() => result.current.start());
    act(() => result.current.next(1)); // total=1, step 0 é o último
    expect(result.current.active).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("prev() decrementa o step", () => {
    const { result } = renderHook(() => useTour(STORAGE_KEY));
    act(() => result.current.start());
    act(() => result.current.next(3));
    act(() => result.current.prev());
    expect(result.current.step).toBe(0);
  });

  it("prev() não desce abaixo de 0", () => {
    const { result } = renderHook(() => useTour(STORAGE_KEY));
    act(() => result.current.start());
    act(() => result.current.prev());
    expect(result.current.step).toBe(0);
  });

  it("finish() encerra o tour e grava localStorage", () => {
    const { result } = renderHook(() => useTour(STORAGE_KEY));
    act(() => result.current.start());
    act(() => result.current.finish());
    expect(result.current.active).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("não abre automaticamente se localStorage já está definido", () => {
    vi.useFakeTimers();
    localStorage.setItem(STORAGE_KEY, "1");
    const { result } = renderHook(() => useTour(STORAGE_KEY));
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.active).toBe(false);
    vi.useRealTimers();
  });

  it("abre automaticamente após 800ms se localStorage não definido", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useTour(STORAGE_KEY));
    expect(result.current.active).toBe(false);
    act(() => vi.advanceTimersByTime(800));
    expect(result.current.active).toBe(true);
    vi.useRealTimers();
  });
});
