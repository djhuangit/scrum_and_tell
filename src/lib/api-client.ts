/**
 * API client with retry logic and error handling.
 */

interface FetchWithRetryOptions extends RequestInit {
  maxRetries?: number;
  retryDelay?: number;
  retryOnStatusCodes?: number[];
}

interface ApiError extends Error {
  status?: number;
  statusText?: string;
}

/**
 * Fetch wrapper with automatic retry logic for failed requests.
 *
 * Args:
 *     url: The URL to fetch
 *     options: Fetch options including retry configuration
 *
 * Returns:
 *     The fetch Response object
 *
 * Raises:
 *     ApiError: If all retries fail
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    retryOnStatusCodes = [408, 429, 500, 502, 503, 504],
    ...fetchOptions
  } = options;

  let lastError: ApiError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      if (
        !response.ok &&
        retryOnStatusCodes.includes(response.status) &&
        attempt < maxRetries
      ) {
        await delay(retryDelay * Math.pow(2, attempt));
        continue;
      }

      return response;
    } catch (error) {
      lastError = createApiError(error);

      if (attempt < maxRetries) {
        await delay(retryDelay * Math.pow(2, attempt));
        continue;
      }
    }
  }

  throw lastError || new Error('Request failed after all retries');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createApiError(error: unknown): ApiError {
  if (error instanceof Error) {
    const apiError: ApiError = new Error(error.message);
    apiError.name = 'ApiError';
    return apiError;
  }
  const apiError: ApiError = new Error('An unknown error occurred');
  apiError.name = 'ApiError';
  return apiError;
}

/**
 * Type-safe JSON fetch helper with retry support.
 *
 * Args:
 *     url: The URL to fetch
 *     options: Fetch options including retry configuration
 *
 * Returns:
 *     Parsed JSON response
 *
 * Raises:
 *     ApiError: If the request fails or response is not valid JSON
 */
export async function fetchJson<T>(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    const error: ApiError = new Error(errorText);
    error.status = response.status;
    error.statusText = response.statusText;
    error.name = 'ApiError';
    throw error;
  }

  return response.json();
}

/**
 * POST JSON data with retry support.
 *
 * Args:
 *     url: The URL to post to
 *     data: The data to send as JSON
 *     options: Additional fetch options
 *
 * Returns:
 *     Parsed JSON response
 */
export async function postJson<T, R>(
  url: string,
  data: T,
  options: FetchWithRetryOptions = {}
): Promise<R> {
  return fetchJson<R>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
    ...options,
  });
}
