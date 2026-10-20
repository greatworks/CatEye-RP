import type {Locator,Page} from '@playwright/test';
import type {Document} from '../src/model/types';
export function errorHintFixture(): Document;
export function exerciseErrorHint(page: Page, scope: Locator | Page): Promise<void>;
