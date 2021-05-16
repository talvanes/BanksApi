import { assert } from "./deps.ts";
import { httpErrors } from "./httpError.ts";
import { isMediaType } from "./isMediaType.ts";
import { FormDataReader } from "./multipart.ts";
const defaultBodyContentTypes = {
    json: ["json", "application/*+json", "application/csp-report"],
    form: ["urlencoded"],
    formData: ["multipart"],
    text: ["text"],
};
const decoder = new TextDecoder();
export class RequestBody {
    #body;
    #formDataReader;
    #has;
    #headers;
    #readAllBody;
    #type;
    #valuePromise = () => {
        return this.#readAllBody ?? (this.#readAllBody = Deno.readAll(this.#body));
    };
    constructor(request) {
        const { body, headers } = request;
        this.#body = body;
        this.#headers = headers;
    }
    get({ type, contentTypes }) {
        if (type === "reader" && this.#type && this.#type !== "reader") {
            throw new TypeError("Body already consumed and cannot be returned as a reader.");
        }
        if (type === "form-data" && this.#type && this.#type !== "form-data") {
            throw new TypeError("Body already consumed and cannot be returned as form data.");
        }
        if (this.#type === "reader" && type !== "reader") {
            throw new TypeError("Body already consumed as a reader and can only be returned as a reader.");
        }
        if (this.#type === "form-data" && type !== "form-data") {
            throw new TypeError("Body already consumed as form data and can only be returned as form data.");
        }
        if (type && contentTypes) {
            throw new TypeError(`"type" and "contentTypes" cannot be specified at the same time`);
        }
        if (type === "reader") {
            this.#type = "reader";
            return { type, value: this.#body };
        }
        if (!this.has()) {
            this.#type = "undefined";
        }
        else if (!this.#type) {
            const encoding = this.#headers.get("content-encoding") ?? "identity";
            if (encoding !== "identity") {
                throw new httpErrors.UnsupportedMediaType(`Unsupported content-encoding: ${encoding}`);
            }
        }
        if (this.#type === "undefined") {
            if (type) {
                throw new TypeError(`Body is undefined and cannot be returned as "${type}".`);
            }
            return { type: "undefined", value: undefined };
        }
        if (!type) {
            const contentType = this.#headers.get("content-type");
            assert(contentType);
            contentTypes = contentTypes ?? {};
            const contentTypesJson = [
                ...defaultBodyContentTypes.json,
                ...(contentTypes.json ?? []),
            ];
            const contentTypesForm = [
                ...defaultBodyContentTypes.form,
                ...(contentTypes.form ?? []),
            ];
            const contentTypesFormData = [
                ...defaultBodyContentTypes.formData,
                ...(contentTypes.formData ?? []),
            ];
            const contentTypesText = [
                ...defaultBodyContentTypes.text,
                ...(contentTypes.text ?? []),
            ];
            if (contentTypes.raw && isMediaType(contentType, contentTypes.raw)) {
                type = "raw";
            }
            else if (isMediaType(contentType, contentTypesJson)) {
                type = "json";
            }
            else if (isMediaType(contentType, contentTypesForm)) {
                type = "form";
            }
            else if (isMediaType(contentType, contentTypesFormData)) {
                type = "form-data";
            }
            else if (isMediaType(contentType, contentTypesText)) {
                type = "text";
            }
            else {
                type = "raw";
            }
        }
        assert(type);
        let value;
        switch (type) {
            case "form":
                this.#type = "raw";
                value = async () => new URLSearchParams(decoder.decode(await this.#valuePromise()).replace(/\+/g, " "));
                break;
            case "form-data":
                this.#type = "form-data";
                value = () => {
                    const contentType = this.#headers.get("content-type");
                    assert(contentType);
                    return this.#formDataReader ??
                        (this.#formDataReader = new FormDataReader(contentType, this.#body));
                };
                break;
            case "json":
                this.#type = "raw";
                value = async () => JSON.parse(decoder.decode(await this.#valuePromise()));
                break;
            case "raw":
                this.#type = "raw";
                value = () => this.#valuePromise();
                break;
            case "text":
                this.#type = "raw";
                value = async () => decoder.decode(await this.#valuePromise());
                break;
            default:
                throw new TypeError(`Invalid body type: "${type}"`);
        }
        return {
            type,
            get value() {
                return value();
            },
        };
    }
    has() {
        return this.#has !== undefined
            ? this.#has
            : (this.#has = this.#headers.get("transfer-encoding") !== null ||
                !!parseInt(this.#headers.get("content-length") ?? "", 10));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9keS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJvZHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUNuQyxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFDNUMsT0FBTyxFQUFFLFdBQVcsRUFBRSxNQUFNLGtCQUFrQixDQUFDO0FBQy9DLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQStEaEQsTUFBTSx1QkFBdUIsR0FBRztJQUM5QixJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsb0JBQW9CLEVBQUUsd0JBQXdCLENBQUM7SUFDOUQsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDO0lBQ3BCLFFBQVEsRUFBRSxDQUFDLFdBQVcsQ0FBQztJQUN2QixJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUM7Q0FDZixDQUFDO0FBRUYsTUFBTSxPQUFPLEdBQUcsSUFBSSxXQUFXLEVBQUUsQ0FBQztBQUVsQyxNQUFNLE9BQU8sV0FBVztJQUN0QixLQUFLLENBQWM7SUFDbkIsZUFBZSxDQUFrQjtJQUNqQyxJQUFJLENBQVc7SUFDZixRQUFRLENBQVU7SUFDbEIsWUFBWSxDQUF1QjtJQUNuQyxLQUFLLENBQWdEO0lBRXJELGFBQWEsR0FBRyxHQUFHLEVBQUU7UUFDbkIsT0FBTyxJQUFJLENBQUMsWUFBWSxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO0lBQzdFLENBQUMsQ0FBQztJQUVGLFlBQVksT0FBc0I7UUFDaEMsTUFBTSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsR0FBRyxPQUFPLENBQUM7UUFDbEMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7UUFDbEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7SUFDMUIsQ0FBQztJ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