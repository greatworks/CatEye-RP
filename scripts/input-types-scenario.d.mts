import type { Locator, Page } from '@playwright/test';
import type { Document } from '../src/model/types';
export function inputTypesFixture(): Document;
export function exerciseInputTypes(page: Page, scope: Page | Locator): Promise<void>;
