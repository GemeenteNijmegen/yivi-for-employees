import { render } from '@gemeentenijmegen/webapp';
import { Duration } from 'aws-cdk-lib';


test('Can render default templates from package', async () => {
  const html = await render({}, '{{>header}} {{>footer}}');
  expect(html).toContain('<!doctype html>');
  expect(html).toContain('</html>');
});


test('duration convertion', () => {
  const tomorrow = Duration.days(1);

  console.log(tomorrow.toHumanString());
});