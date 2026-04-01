import fs from 'fs';
import path from 'path';
import type { CollectedItem } from '../types/collector';

const RESULTS_DIR = path.resolve(__dirname, '../../results');

export function saveJson(filename: string, data: CollectedItem[]): void {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  const filePath = path.join(RESULTS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Saved ${data.length} items → ${filePath}`);
}

export function appendJson(filename: string, item: CollectedItem): void {
  if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
  }
  const filePath = path.join(RESULTS_DIR, filename);
  let existing: CollectedItem[] = [];
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CollectedItem[];
  }
  existing.push(item);
  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
}
