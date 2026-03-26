import React from "react";
import { renderHook, act } from "@testing-library/react";
import { usePushToTalk } from "@/hooks/usePushToTalk";

function fireKey(type: "keydown" | "keyup", key: string, opts: Partial<KeyboardEvent> = {}): void {
  window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, ...opts }));
}

describe("usePushToTalk", () => {
  let onMuteChange: jest.Mock;
  let onRelease: jest.Mock;
  let textInputRef: React.RefObject<HTMLInputElement | null>;
  let inputElement: HTMLInputElement;

  beforeEach(() => {
    onMuteChange = jest.fn();
    onRelease = jest.fn();
    inputElement = document.createElement("input");
    document.body.appendChild(inputElement);
    textInputRef = { current: inputElement };
  });

  afterEach(() => {
    document.body.removeChild(inputElement);
  });

  function renderPTT(enabled = true) {
    return renderHook(() =>
      usePushToTalk({
        enabled,
        textInputRef,
        onMuteChange,
        onRelease,
      }),
    );
  }

  it("should not be holding initially", () => {
    const { result } = renderPTT();
    expect(result.current.isHolding).toBe(false);
  });

  it("should call onMuteChange(false) on Space keydown", () => {
    renderPTT();

    act(() => {
      fireKey("keydown", " ");
    });

    expect(onMuteChange).toHaveBeenCalledWith(false);
  });

  it("should set isHolding true on Space keydown", () => {
    const { result } = renderPTT();

    act(() => {
      fireKey("keydown", " ");
    });

    expect(result.current.isHolding).toBe(true);
  });

  it("should call onMuteChange(true) and onRelease on Space keyup", () => {
    renderPTT();

    act(() => {
      fireKey("keydown", " ");
    });

    onMuteChange.mockClear();

    act(() => {
      fireKey("keyup", " ");
    });

    expect(onMuteChange).toHaveBeenCalledWith(true);
    expect(onRelease).toHaveBeenCalled();
  });

  it("should set isHolding false on Space keyup", () => {
    const { result } = renderPTT();

    act(() => {
      fireKey("keydown", " ");
    });
    expect(result.current.isHolding).toBe(true);

    act(() => {
      fireKey("keyup", " ");
    });
    expect(result.current.isHolding).toBe(false);
  });

  it("should ignore key repeat events", () => {
    renderPTT();

    act(() => {
      fireKey("keydown", " ");
    });

    onMuteChange.mockClear();

    act(() => {
      fireKey("keydown", " ", { repeat: true });
    });

    expect(onMuteChange).not.toHaveBeenCalled();
  });

  it("should ignore Space when text input is focused", () => {
    renderPTT();

    inputElement.focus();

    act(() => {
      fireKey("keydown", " ");
    });

    expect(onMuteChange).not.toHaveBeenCalled();
  });

  it("should treat window blur as key release", () => {
    renderPTT();

    act(() => {
      fireKey("keydown", " ");
    });

    onMuteChange.mockClear();

    act(() => {
      window.dispatchEvent(new Event("blur"));
    });

    expect(onMuteChange).toHaveBeenCalledWith(true);
    expect(onRelease).toHaveBeenCalled();
  });

  it("should not fire on non-Space keys", () => {
    renderPTT();

    act(() => {
      fireKey("keydown", "a");
    });

    expect(onMuteChange).not.toHaveBeenCalled();
  });

  it("should be no-op when disabled", () => {
    renderPTT(false);

    act(() => {
      fireKey("keydown", " ");
    });

    expect(onMuteChange).not.toHaveBeenCalled();
  });

  it("should not fire onRelease if not currently holding", () => {
    renderPTT();

    act(() => {
      fireKey("keyup", " ");
    });

    expect(onRelease).not.toHaveBeenCalled();
  });

  it("should clean up listeners on unmount", () => {
    const { unmount } = renderPTT();
    unmount();

    act(() => {
      fireKey("keydown", " ");
    });

    expect(onMuteChange).not.toHaveBeenCalled();
  });
});
