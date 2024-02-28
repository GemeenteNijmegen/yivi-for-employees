import { render } from '@gemeentenijmegen/webapp'

test('Can render default templates from package', async () => {
  const html = await render({}, '{{>header}} {{>footer}}');
  expect(html).toContain('<!doctype html>')
  expect(html).toContain('</html>')
});