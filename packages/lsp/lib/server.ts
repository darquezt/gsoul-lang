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
  MarkupKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { parse } from '@gsoul-lang/parsing';
import { typeCheck, TypingSeeker } from '@gsoul-lang/typechecking';
import { TypeEffUtils } from '@gsoul-lang/core/utils';

const connection = createConnection(ProposedFeatures.all);

connection.console.log('running');

const documents = new TextDocuments(TextDocument);

const typings: Map<string, TypingSeeker> = new Map();

connection.onInitialize(() => {
  connection.console.info('Initializing GSens language server');

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: {},
      hoverProvider: true,
    },
  };
});

const parseFile = (doc: TextDocument): void => {
  try {
    const { failures, result: parsedFile } = parse(doc.getText());

    const diagnostics: Diagnostic[] = [];

    failures.forEach(({ reason, token }) => {
      const line = token.line - 1;
      const col = token.col - 1;

      const diagnostic = Diagnostic.create(
        {
          start: { line, character: col },
          end: { line, character: col + token.lexeme.length },
        },
        reason ?? 'Syntax error',
        DiagnosticSeverity.Error,
      );

      diagnostics.push(diagnostic);
    });

    if (diagnostics.length === 0) {
      const typecheckingResult = typeCheck(parsedFile);

      if (!typecheckingResult.isOk) {
        const { token, message } = typecheckingResult.error;

        const line = token.line - 1;
        const col = token.col - 1;

        const diagnostic = Diagnostic.create(
          {
            start: { line, character: col },
            end: { line, character: col + token.lexeme.length },
          },
          message ?? 'Type Error',
          DiagnosticSeverity.Error,
        );

        diagnostics.push(diagnostic);
      } else {
        const { typings: docTypings } = typecheckingResult.value;

        typings.set(doc.uri, docTypings);
      }
    }

    connection.sendDiagnostics({
      uri: doc.uri,
      diagnostics,
    });
  } catch (e) {
    connection.console.error(
      JSON.stringify(e, ['message', 'arguments', 'type', 'name', 'stack'], 2),
    );
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

connection.onHover((params) => {
  const docTypings = typings.get(params.textDocument.uri);

  if (!docTypings) {
    return;
  }

  const typingAssoc = docTypings.get(
    params.position.line + 1,
    params.position.character + 1,
  );

  if (!typingAssoc) {
    return;
  }
  const [token, typeEff] = typingAssoc;
  const printedTE = TypeEffUtils.format(typeEff);

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: printedTE,
    },
    range: {
      start: {
        line: token.line - 1,
        character: token.col - 1,
      },
      end: {
        line: token.line - 1,
        character: token.col + token.lexeme.length - 1,
      },
    },
  };
});

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
