/*
 * Copyright (c) 2021 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import RethinkPlugin from "./plugin.js";
import * as pres from "../plugins/plugin-response.js";
import * as util from "../commons/util.js";
import * as dnsutil from "../commons/dnsutil.js";
import IOState from "./io-state.js";

export function handleRequest(event) {
  return proxyRequest(event);
}

async function proxyRequest(event) {
  if (optionsRequest(event.request)) return util.respond204();

  const io = new IOState();

  try {
    const plugin = new RethinkPlugin(event);
    await plugin.initIoState(io);
    if (io.httpResponse) {
      const ua = event.request.headers.get("User-Agent");
      if (util.fromBrowser(ua)) io.setCorsHeadersIfNeeded();
      return io.httpResponse;
    }
    await util.timedSafeAsyncOp(
      /* op*/ async () => plugin.execute(),
      /* waitMs*/ dnsutil.requestTimeout(),
      /* onTimeout*/ async () => errorResponse(io)
    );
  } catch (err) {
    log.e("doh", "proxy-request error", err.stack);
    errorResponse(io, err);
  }

  const ua = event.request.headers.get("User-Agent");
  if (util.fromBrowser(ua)) io.setCorsHeadersIfNeeded();

  return io.httpResponse;
}

function optionsRequest(request) {
  return request.method === "OPTIONS";
}

function errorResponse(io, err = null) {
  const eres = pres.errResponse("doh.js", err);
  io.dnsExceptionResponse(eres);
}
