import { ApiGatewayV2Response, Response } from '@gemeentenijmegen/apigateway-http/lib/V2/Response';
import { render } from '@gemeentenijmegen/webapp';
import * as issueTemplate from './templates/disclose.mustache';

export async function handler (_event: any, _context: any):Promise<ApiGatewayV2Response> {
  try {
    const data = {
      title: 'Disclose',
      shownav: true,
      yiviServer: `https://${process.env.YIVI_API_HOST}`,
    };
    const html = await render(data, issueTemplate.default);
    return Response.html(html, 200);
  } catch (err) {
    console.error(err);
    return Response.error(500);
  }
};
