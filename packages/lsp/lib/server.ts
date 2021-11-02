import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  CompletionItem,
  CompletionItemKind,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { parse } from '@gsens-lang/parsing';

const connection = createConnection(ProposedFeatures.all);

const documents = new TextDocuments(TextDocument);

connection.onInitialize(() => {
  connection.console.info('Initializing GSens language server');

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
    },
  };
});

documents.onDidOpen((event) => {
  const { failures } = parse(event.document.getText());

  const diagnostics: Diagnostic[] = [];

  failures.map(({ reason, token }) => {
    const line = token.line ?? 0;

    const diagnostic = Diagnostic.create(
      { start: { line, character: 0 }, end: { line, character: 1024 } },
      reason ?? 'Syntax error',
      DiagnosticSeverity.Error,
    );

    diagnostics.push(diagnostic);
  });

  connection.sendDiagnostics({
    uri: event.document.uri,
    diagnostics,
  });
});

const keywords = ['fun', 'var', 'print']; // TODO: Export them from parsing module

connection.onCompletion(() => {
  const keywordCompletions: CompletionItem[] = keywords.map((kw) => ({
    label: kw,
    kind: CompletionItemKind.Keyword,
  }));

  return keywordCompletions;
});
