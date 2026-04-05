
API endpoint: https://stripe-transparency.human-singularity.workers.dev/

Worker Code:
```
// src/index.js
var src_default = {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Max-Age": "86400"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
        status: 204
      });
    }
    if (request.method === "GET") {
      return handleStripeRequest(env, corsHeaders);
    } else {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders
      });
    }
    ;
  }
};
async function handleStripeRequest(env, corsHeaders) {
  const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
  const yearStart = Math.floor(new Date(currentYear, 0, 1).getTime() / 1e3);
  const yearEnd = Math.floor(new Date(currentYear, 11, 31, 23, 59, 59).getTime() / 1e3);
  const searchQuery = `created>=${yearStart} AND created<=${yearEnd} AND status:"succeeded"`;
  const url = `https://api.stripe.com/v1/charges/search?query=${encodeURIComponent(searchQuery)}&limit=100`;
  const response = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    }
  });
  if (!response.ok) {
    console.error("Failed to fetch Stripe charges:", response.statusText);
    return new Response("Internal Server Error", { status: 500 });
  }
  const chargesData = await response.json();
  const charges = chargesData.data || [];
  const authorizedCharges = charges.filter((charge) => charge.outcome && charge.outcome.type === "authorized");
  const anonymizeCharge = (charge) => ({
    name: charge.billing_details.name ? charge.billing_details.name.split(" ").map((part, index, array) => {
      if (index === array.length - 1) {
        return "*".repeat(part.length);
      }
      return part;
    }).join(" ") : "Anonymous",
    email: charge.billing_details.email ? charge.billing_details.email.replace(/^(.{1,4})(.*?)(@)([^.]+)(\..*)$/, (match, p1, p2, p3, domain, p4) => {
      let lengthP2 = p2.length;
      if (lengthP2 < 3) {
        lengthP2 = 8;
      }
      let domainAnonymized = domain.length <= 5 ? "*".repeat(7) : domain.replace(/./g, "*");
      return p1 + "*".repeat(lengthP2) + p3 + domainAnonymized + p4;
    }) : "anonymous@example.com",
    amount_paid: charge.amount_captured / 100,
    // Assuming the amount is in cents
    currency: charge.currency,
    charge_date: new Date(charge.created * 1e3).toISOString()
    // Convert the Unix timestamp to ISO 8601 format
  });
  const recent = authorizedCharges.slice(0, 10).map(anonymizeCharge);
  const currentYearCharges = authorizedCharges;
  const yearlyStats = {
    year: currentYear,
    total_donations: currentYearCharges.length,
    total_amount: currentYearCharges.reduce((sum, charge) => sum + charge.amount_captured / 100, 0),
    currencies: [...new Set(currentYearCharges.map((charge) => charge.currency))],
    donations: currentYearCharges.map(anonymizeCharge)
  };
  const responseData = {
    recent,
    current_year: yearlyStats
  };
  return new Response(JSON.stringify(responseData), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    },
    status: response.status,
    statusText: response.statusText
  });
}
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
```

example response:
```
{"recent":[{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":40,"currency":"eur","charge_date":"2026-04-03T13:16:33.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":1,"currency":"eur","charge_date":"2026-04-02T14:32:44.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":30,"currency":"eur","charge_date":"2026-03-09T16:19:19.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":1,"currency":"eur","charge_date":"2026-03-07T15:51:04.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":1,"currency":"eur","charge_date":"2026-03-02T14:33:51.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":1,"currency":"eur","charge_date":"2026-02-07T15:51:05.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":50,"currency":"eur","charge_date":"2026-02-02T13:34:43.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":1,"currency":"eur","charge_date":"2026-02-02T13:32:25.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":1,"currency":"eur","charge_date":"2026-01-07T14:49:53.000Z"}],"current_year":{"year":2026,"total_donations":9,"total_amount":126,"currencies":["eur"],"donations":[{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":40,"currency":"eur","charge_date":"2026-04-03T13:16:33.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":1,"currency":"eur","charge_date":"2026-04-02T14:32:44.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":30,"currency":"eur","charge_date":"2026-03-09T16:19:19.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":1,"currency":"eur","charge_date":"2026-03-07T15:51:04.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":1,"currency":"eur","charge_date":"2026-03-02T14:33:51.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":1,"currency":"eur","charge_date":"2026-02-07T15:51:05.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":50,"currency":"eur","charge_date":"2026-02-02T13:34:43.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":1,"currency":"eur","charge_date":"2026-02-02T13:32:25.000Z"},{"name":"Bruno ******","email":"brun********@****************.com","amount_paid":1,"currency":"eur","charge_date":"2026-01-07T14:49:53.000Z"}]}}
```