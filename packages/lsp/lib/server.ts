#!/usr/bin/env node

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

connection.console.log('running');

const documents = new TextDocuments(TextDocument);

connection.onInitialize(() => {
  connection.console.info('Initializing GSens language server');

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
    },
  };
});

const parseFile = (doc: TextDocument): void => {
  try {
    const { failures } = parse(doc.getText());

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
      uri: doc.uri,
      diagnostics,
    });
  } catch (e) {
    connection.console.error(e);
  }
};

documents.onDidOpen((event) => {
  connection.console.info('Open file');
  parseFile(event.document);
});

documents.onDidChangeContent((event) => {
  connection.console.info('Change file');
  parseFile(event.document);
});

const keywords = ['fun', 'var', 'print']; // TODO: Export them from parsing module

connection.onCompletion(() => {
  connection.console.info('completion');
  const keywordCompletions: CompletionItem[] = keywords.map((kw) => ({
    label: kw,
    kind: CompletionItemKind.Keyword,
  }));

  return keywordCompletions;
});

documents.listen(connection);
connection.listen();
