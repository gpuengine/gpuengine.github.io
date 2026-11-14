export class JsonDocumentClient {
  #worker = new Worker(new URL("./json_document_worker.js", import.meta.url), { type: "module" });
  #pendingRequests = new Map();
  #nextRequestId = 1;

  constructor() {
    this.#worker.addEventListener("message", ({ data }) => this.#settle(data));
  }

  request(command, payload) {
    const requestId = this.#nextRequestId++;
    return new Promise((resolve, reject) => {
      this.#pendingRequests.set(requestId, { resolve, reject });
      this.#worker.postMessage({ requestId, command, payload });
    });
  }

  #settle({ requestId, result, errorMessage }) {
    const pending = this.#pendingRequests.get(requestId);
    if (!pending) return;
    this.#pendingRequests.delete(requestId);
    if (errorMessage === undefined) pending.resolve(result);
    else pending.reject(new Error(errorMessage));
  }
}
