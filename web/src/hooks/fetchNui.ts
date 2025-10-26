import { isEnvBrowser } from "./misc";

/**
 * Simple wrapper around fetch API tailored for CEF/NUI use. This abstraction
 * can be extended to include AbortController if needed or if the response isn't
 * JSON. Tailor it to your needs.
 *
 * @param eventName - The endpoint eventname to target
 * @param data - Data you wish to send in the NUI Callback
 * @param mockData - Mock data to be returned if in the browser
 *
 * @return returnData - A promise for the data sent back by the NuiCallbacks CB argument
 */
/* Live Function */
export async function fetchNui<T = unknown>(
  eventName: string,
  data?: unknown
): Promise<T> {
  const options = {
    method: "post",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(data),
  };

  const resourceName = (window as any).GetParentResourceName
    ? (window as any).GetParentResourceName()
    : "nui-frame-app";

  try {
    const resp = await fetch(`https://${resourceName}/${eventName}`, options);

    if (!resp.ok) {
      // silently ignore non-200 responses
      return null as T;
    }

    try {
      return (await resp.json()) as T;
    } catch {
      // silently ignore invalid JSON
      return null as T;
    }
  } catch {
    // silently ignore fetch/NUI errors (e.g., "Failed to fetch")
    return null as T;
  }
}


/* Old Function
export async function fetchNui<T = unknown>(
    eventName: string,
    data?: unknown,
    mockData?: T,
): Promise<T> {
    const options = {
        method: "post",
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify(data),
    };

    if (isEnvBrowser() && mockData) return mockData;

    const resourceName = (window as any).GetParentResourceName
        ? (window as any).GetParentResourceName()
        : "nui-frame-app";

    const resp = await fetch(`https://${resourceName}/${eventName}`, options);

    const respFormatted = await resp.json();

    return respFormatted;
}
*/


/*
Debug Function
export async function fetchNui<T = unknown>(
    eventName: string,
    data?: unknown
): Promise<T> {
    const options = {
        method: "post",
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify(data),
    };

    // ✅ If testing in browser and mock data is provided, just return it
    // if (isEnvBrowser() && mockData) return mockData;

    // ✅ Detect the resource name dynamically
    const resourceName = (window as any).GetParentResourceName
        ? (window as any).GetParentResourceName()
        : "nui-frame-app";

    try {
        // ✅ Attempt the fetch call
        const resp = await fetch(`https://${resourceName}/${eventName}`, options);

        // ✅ Handle non-200 responses gracefully
        if (!resp.ok) {
            console.error(`[fetchNui] ${eventName} failed: ${resp.status} ${resp.statusText}`);
            return null as T;
        }

        // ✅ Try parsing JSON safely
        try {
            const respFormatted = await resp.json();
            return respFormatted;
        } catch (jsonErr) {
            console.error(`[fetchNui] ${eventName} returned invalid JSON`, jsonErr);
            return null as T;
        }
    } catch (err) {
        // ✅ Catch network/NUI-level failures (like "Failed to fetch")
        console.warn(`[fetchNui] Failed for ${eventName}:`, err);
        return null as T;
    }
}
*/