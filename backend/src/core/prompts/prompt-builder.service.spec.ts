import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ClinicProfileService } from '../profile/clinic-profile.service';
import { PromptBuilder } from './prompt-builder.service';

function tree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clinics-'));
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  }
  return root;
}

const DEFAULT_PROFILE = `
engine: tools
llm: {}
features: { visitTypeQuestion: true, referralFlow: operator, showPrices: on_request, walkIn: unknown, questions: [schedule] }
patientFields: [fullName, phone, birthday]
synonyms: {}
symptomHints: []
templates: {}
info: {}
`;

describe('PromptBuilder', () => {
  const root = tree({
    'core/profile.yaml': DEFAULT_PROFILE,
    'nets/alpha/profile.yaml': 'clinicNetId: 5\ndisplayName: Альфа\nfeatures: { walkIn: yes }\nsynonyms: { узи: [ультразвуковое] }',
    'core/prompts/answer.md': 'Ты ассистент клиники {{clinicName}}. Сегодня {{today}}.',
    'core/prompts/mis/medflex/answer.md': 'Пациент идентифицируется по телефону.',
    'nets/alpha/prompts/answer.md': 'Обращайся на «Вы».',
  });
  const profiles = new ClinicProfileService(root);
  profiles.reload();
  const builder = new PromptBuilder(profiles, root);

  it('склеивает ядро, слой МИС и слой сети; подставляет переменные', () => {
    const p = builder.build('answer', { clinicNetId: 5, mis: 'medflex' }, { today: '2026-11-18' });
    expect(p.text).toBe(
      'Ты ассистент клиники Альфа. Сегодня 2026-11-18.\n\nПациент идентифицируется по телефону.\n\nОбращайся на «Вы».',
    );
    expect(p.layers).toEqual(['core/prompts/answer.md', 'core/prompts/mis/medflex/answer.md', 'nets/alpha/prompts/answer.md']);
    expect(p.hash).toHaveLength(12);
  });

  it('сеть без профиля получает только ядро; хеш не зависит от переменных', () => {
    const a = builder.build('answer', { clinicNetId: 99, mis: 'local' }, { today: '1' });
    const b = builder.build('answer', { clinicNetId: 99, mis: 'local' }, { today: '2' });
    expect(a.layers).toEqual(['core/prompts/answer.md']);
    expect(a.hash).toBe(b.hash);
  });

  it('пропущенная переменная — ошибка, а не пустое место в промпте', () => {
    expect(() => builder.build('answer', { clinicNetId: 5 })).toThrow('{{today}}');
  });

  it('coreOverride заменяет ядро', () => {
    const p = builder.build('answer', { clinicNetId: 5 }, {}, { coreOverride: 'Своё ядро' });
    expect(p.text).toBe('Своё ядро\n\nОбращайся на «Вы».');
  });

  it('профиль сети сливается с профилем по умолчанию', () => {
    const p = profiles.forNet(5);
    expect(p.features).toMatchObject({ walkIn: 'yes', referralFlow: 'operator' });
    expect(p.synonyms).toEqual({ узи: ['ультразвуковое'] });
    expect(profiles.forNet(99).slug).toBe('default');
  });
});

describe('профили репозитория', () => {
  it('src/clinics загружаются и проходят схему', () => {
    const profiles = new ClinicProfileService(path.resolve(__dirname, '../../clinics'));
    profiles.reload();
    expect(profiles.forNet(2).slug).toBe('xxi-vek');
    expect(profiles.forNet(1).slug).toBe('21-vek-spb');
    const builder = new PromptBuilder(profiles, path.resolve(__dirname, '../../clinics'));
    expect(builder.build('legacy', { clinicNetId: 2, mis: 'local' }).text).toContain('## Роль');
  });
});
