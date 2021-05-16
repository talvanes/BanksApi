import { Cookies } from "./cookies.ts";
import { acceptable, acceptWebSocket } from "./deps.ts";
import { createHttpError } from "./httpError.ts";
import { Request } from "./request.ts";
import { Response } from "./response.ts";
import { send } from "./send.ts";
import { ServerSentEventTarget, } from "./server_sent_event.ts";
export class Context {
    #socket;
    #sse;
    app;
    cookies;
    get isUpgradable() {
        return acceptable(this.request);
    }
    respond;
    request;
    response;
    get socket() {
        return this.#socket;
    }
    state;
    constructor(app, serverRequest, secure = false) {
        this.app = app;
        this.state = app.state;
        this.request = new Request(serverRequest, app.proxy, secure);
        this.respond = true;
        this.response = new Response(this.request);
        this.cookies = new Cookies(this.request, this.response, {
            keys: this.app.keys,
            secure: this.request.secure,
        });
    }
    assert(condition, errorStatus = 500, message, props) {
        if (condition) {
            return;
        }
        const err = createHttpError(errorStatus, message);
        if (props) {
            Object.assign(err, props);
        }
        throw err;
    }
    send(options) {
        const { path = this.request.url.pathname, ...sendOptions } = options;
        return send(this, path, sendOptions);
    }
    sendEvents(options) {
        if (this.#sse) {
            return this.#sse;
        }
        this.respond = false;
        return this.#sse = new ServerSentEventTarget(this.app, this.request.serverRequest, options);
    }
    throw(errorStatus, message, props) {
        const err = createHttpError(errorStatus, message);
        if (props) {
            Object.assign(err, props);
        }
        throw err;
    }
    async upgrade() {
        if (this.#socket) {
            return this.#socket;
        }
        const { conn, r: bufReader, w: bufWriter, headers } = this.request.serverRequest;
        this.#socket = await acceptWebSocket({ conn, bufReader, bufWriter, headers });
        this.respond = false;
        return this.#socket;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGV4dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImNvbnRleHQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBR0EsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUN2QyxPQUFPLEVBQUUsVUFBVSxFQUFFLGVBQWUsRUFBYSxNQUFNLFdBQVcsQ0FBQztBQUNuRSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sZ0JBQWdCLENBQUM7QUFFakQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUN2QyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ3pDLE9BQU8sRUFBRSxJQUFJLEVBQWUsTUFBTSxXQUFXLENBQUM7QUFDOUMsT0FBTyxFQUNMLHFCQUFxQixHQUV0QixNQUFNLHdCQUF3QixDQUFDO0FBYWhDLE1BQU0sT0FBTyxPQUFPO0lBQ2xCLE9BQU8sQ0FBYTtJQUNwQixJQUFJLENBQXlCO0lBRzdCLEdBQUcsQ0FBcUI7SUFJeEIsT0FBTyxDQUFVO0lBS2pCLElBQUksWUFBWTtRQUNkLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNsQyxDQUFDO0lBVUQsT0FBTyxDQUFVO0lBR2pCLE9BQU8sQ0FBVTtJQUlqQixRQUFRLENBQVc7SUFJbkIsSUFBSSxNQUFNO1FBQ1IsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQ3RCLENBQUM7SUFnQkQsS0FBSyxDQUFJO0lBRVQsWUFDRSxHQUFtQixFQUNuQixhQUE0QixFQUM1QixNQUFNLEdBQUcsS0FBSztRQUVkLElBQUksQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1FBQ2YsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDN0Qs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