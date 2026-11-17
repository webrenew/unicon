import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/nextjs", () => ({ captureException }));

import BundlesError from "./error";

describe("BundlesError", () => {
  it("should report the caught error to Sentry", () => {
    const error = new Error("Minified React error #412; visit https://react.dev/errors/412");

    render(<BundlesError error={error} reset={() => {}} />);

    expect(captureException).toHaveBeenCalledWith(error);
  });
});
