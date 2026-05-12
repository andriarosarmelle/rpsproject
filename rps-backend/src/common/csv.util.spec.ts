import {
  detectCsvDelimiter,
  normalizeCsvHeader,
  parseCsvDocument,
  splitCsvLine,
} from './csv.util';

describe('csv.util', () => {
  it('normalizes French headers', () => {
    expect(normalizeCsvHeader('Prénom')).toBe('prenom');
    expect(normalizeCsvHeader('Adresse courriel')).toBe('adresse_courriel');
  });

  it('detects semicolon-delimited CSV documents', () => {
    const csv = [
      'Nom;Prénom;Adresse courriel;Fonction',
      'Dupont;Jean;jean.dupont@example.com;RH',
    ].join('\n');

    expect(detectCsvDelimiter(csv.split('\n')[0])).toBe(';');
    expect(parseCsvDocument(csv)).toEqual({
      headers: ['nom', 'prenom', 'adresse_courriel', 'fonction'],
      rows: [
        {
          nom: 'Dupont',
          prenom: 'Jean',
          adresse_courriel: 'jean.dupont@example.com',
          fonction: 'RH',
        },
      ],
      dataLineCount: 1,
    });
  });

  it('keeps delimiters inside quoted values', () => {
    expect(splitCsvLine('"Dupont, Jean",RH', ',')).toEqual(['Dupont, Jean', 'RH']);
    expect(splitCsvLine('"Dupont; Jean";RH', ';')).toEqual(['Dupont; Jean', 'RH']);
  });
});
