import { SnowFramePage } from './app.po';

describe('snow-frame App', function() {
  let page: SnowFramePage;

  beforeEach(() => {
    page = new SnowFramePage();
  });

  it('should display message saying app works', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('app works!');
  });
});
