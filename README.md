# TSLox

A Typescript interpreter for Lox (from [Crafting Interpreters](https://craftinginterpreters.com/))

## Running tslox

1. Build the project

    ```bash
    yarn build
    ```

2. Run the interactive shell

    ```bash
    yarn start
    ```

    or run a source file

    ```bash
    yarn start [FILE]
    ```

I should probably pack this app for one to be able to just run `tslox [FILE]` but if you are reading this you probably have no intention of running this or you are actually coding your own version of an interpreter for Lox, so... yeah.

### Running an example

Inside the [/examples](/examples/) folder there are multiple (huh) examples of valid* programs you can run.

\* *Except for the `runtimeError.lox` file which is designed to throw a Runtime Error.*

## Ast generation

In the same spirit of the original jlox, I also coded an AST generator in javascript (What!?) that generates the classes for both `Expr` and `Stmt`. To execute the generator you have to run:

```bash
yarn gen:ast
```

This will write (and overwrite) the `syntax/ast/Expr.ts` and `syntax/ast/Stmt.ts` files.

## Differences with the original implementation

- **Concatenation operator**: I don't like to use the same operator (`+`) for both number sums
and string concatenation. So, differently from the original version of Lox, I implemented the
(explicit) string concatenation by using the `++` operator.

- **Everything comes from the `Object`**: I implemented a simple (empty) global class `Object` from which
every class inherits by default.

- **Syntactic sugar**: In the original implementation of Lox (jlox) syntactic sugar is implemented by both the parser and the runtime engine (Interpreter), by allowing, for example, a certain field of an AST node to be null, which later would be (null-)checked
by the interpreter or other runtime actors to behave as if the field did exist. I prefer
the syntactic sugar to be desugared explicitly in the parser so the runtime actors don't have to be checking everytime. An example of this would be implicit null declaration of variables `var a;` where a is implicitly bound to the value `nil`. In my interpreter the parser has the job of inserting the `nil` value in the AST node. In my opinion, this way the code is better organized but of course it has drawbacks. For example, while developing the `Resolver` class, in order to differentiate between empty return declarations and explicit `nil` returns I had to add the `empty: bool` field in the `Return` AST node.

- **Values type**: In the original Java implementation, the (Java) class `Object` is used to represent the type of the Lox values. Since Typescript has sum types, I implemented a more accurate type called (wait for it...) `Value`, defined as:

  ```ts
  type Value = number | boolean | string | null | LoxCallable | LoxInstance;
  ```

Note that the last two differences have no impact in the end-user of the interpreter and they are just development decisions.
