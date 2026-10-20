import type {Locator,Page} from '@playwright/test';
import type {Document} from '../src/model/types';
export function interactionStyleFixture(): Document;
export function exerciseInteractionStyles(page: Page, scope: Locator | Page): Promise<void>;
export function presentInteractionStyles(scope: Locator | Page): Promise<void>;
