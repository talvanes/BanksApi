import { contentType, Status } from "./deps.ts";
import { encodeUrl, isHtml, isRedirectStatus } from "./util.ts";
export const REDIRECT_BACK = Symbol("redirect backwards");
const BODY_TYPES = ["string", "number", "bigint", "boolean", "symbol"];
const encoder = new TextEncoder();
function isReader(value) {
    return value && typeof value === "object" && "read" in value &&
        typeof value.read === "function";
}
async function convertBody(body, type) {
    let result;
    if (BODY_TYPES.includes(typeof body)) {
        const bodyText = String(body);
        result = encoder.encode(bodyText);
        type = type ?? (isHtml(bodyText) ? "html" : "text/plain");
    }
    else if (body instanceof Uint8Array || isReader(body)) {
        result = body;
    }
    else if (body && typeof body === "object") {
        result = encoder.encode(JSON.stringify(body));
        type = type ?? "json";
    }
    else if (typeof body === "function") {
        const result = body.call(null);
        return convertBody(await result, type);
    }
    else if (body) {
        throw new TypeError("Response body was set but could not convert.");
    }
    return [result, type];
}
export class Response {
    #body;
    #headers = new Headers();
    #request;
    #resources = [];
    #serverResponse;
    #status;
    #type;
    #writable = true;
    #getBody = async () => {
        const [body, type] = await convertBody(this.body, this.type);
        this.type = type;
        return body;
    };
    #setContentType = () => {
        if (this.type) {
            const contentTypeString = contentType(this.type);
            if (contentTypeString && !this.headers.has("Content-Type")) {
                this.headers.append("Content-Type", contentTypeString);
            }
        }
    };
    get body() {
        return this.#body;
    }
    set body(value) {
        if (!this.#writable) {
            throw new Error("The response is not writable.");
        }
        this.#body = value;
    }
    get headers() {
        return this.#headers;
    }
    set headers(value) {
        if (!this.#writable) {
            throw new Error("The response is not writable.");
        }
        this.#headers = value;
    }
    get status() {
        if (this.#status) {
            return this.#status;
        }
        const typeofbody = typeof this.body;
        return this.body &&
            (BODY_TYPES.includes(typeofbody) || typeofbody === "object")
            ? Status.OK
            : Status.NotFound;
    }
    set status(value) {
        if (!this.#writable) {
            throw new Error("The response is not writable.");
        }
        this.#status = value;
    }
    get type() {
        return this.#type;
    }
    set type(value) {
        if (!this.#writable) {
            throw new Error("The response is not writable.");
        }
        this.#type = value;
    }
    get writable() {
        return this.#writable;
    }
    constructor(request) {
        this.#request = request;
    }
    addResource(rid) {
        this.#resources.push(rid);
    }
    destroy() {
        this.#writable = false;
        this.#body = undefined;
        this.#serverResponse = undefined;
        for (const rid of this.#resources) {
            Deno.close(rid);
        }
    }
    redirect(url, alt = "/") {
        if (url === REDIRECT_BACK) {
            url = this.#request.headers.get("Referrer") ?? String(alt);
        }
        else if (typeof url === "object") {
            url = String(url);
        }
        this.headers.set("Location", encodeUrl(url));
        if (!this.status || !isRedirectStatus(this.status)) {
            this.status = Status.Found;
        }
        if (this.#request.accepts("html")) {
            url = encodeURI(url);
            this.type = "text/html; charset=utf-8";
            this.body = `Redirecting to <a href="${url}">${url}</a>.`;
            return;
        }
        this.type = "text/plain; charset=utf-8";
        this.body = `Redirecting to ${url}.`;
    }
    async toServerResponse() {
        if (this.#serverResponse) {
            return this.#serverResponse;
        }
        const body = await this.#getBody();
        this.#setContentType();
        const { headers } = this;
        if (!(body ||
            headers.has("Content-Type") ||
            headers.has("Content-Length"))) {
            headers.append("Content-Length", "0");
        }
        this.#writable = false;
        return this.#serverResponse = {
            status: this.#status ?? (body ? Status.OK : Status.NotFound),
            body,
            headers,
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVzcG9uc2UuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyZXNwb25zZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUdoRCxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQStCaEUsTUFBTSxDQUFDLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBRTFELE1BQU0sVUFBVSxHQUFHLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBRXZFLE1BQU0sT0FBTyxHQUFHLElBQUksV0FBVyxFQUFFLENBQUM7QUFJbEMsU0FBUyxRQUFRLENBQUMsS0FBVTtJQUMxQixPQUFPLEtBQUssSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksTUFBTSxJQUFJLEtBQUs7UUFDMUQsT0FBTyxLQUFLLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQztBQUNyQyxDQUFDO0FBRUQsS0FBSyxVQUFVLFdBQVcsQ0FDeEIsSUFBeUIsRUFDekIsSUFBYTtJQUViLElBQUksTUFBNEMsQ0FBQztJQUNqRCxJQUFJLFVBQVUsQ0FBQyxRQUFRLENBQUMsT0FBTyxJQUFJLENBQUMsRUFBRTtRQUNwQyxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDOUIsTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbEMsSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsQ0FBQztLQUMzRDtTQUFNLElBQUksSUFBSSxZQUFZLFVBQVUsSUFBSSxRQUFRLENBQUMsSUFBSSxDQUFD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