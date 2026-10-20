import type {Locator,Page} from '@playwright/test';
import type {Document} from '../src/model/types';
export function formPropertiesFixture(): Document;
export function exerciseFormProperties(page: Page, scope: Locator | Page): Promise<void>;
