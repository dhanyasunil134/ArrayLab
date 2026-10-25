%{
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int yylex(void);
void yyerror(const char *message);

static int errors = 0;
static int declarations = 0;
%}

%union {
    int number;
    char *text;
}

%token INT FLOAT CHAR DOUBLE
%token <text> IDENTIFIER
%token <number> NUMBER
%token INVALID

%type <text> type

%%

program:
      %empty
    | program statement
    ;

statement:
    type IDENTIFIER '[' NUMBER ']' ';'
    {
        if ($4 <= 0) {
            printf(
                "SEMANTIC ERROR: Array '%s' must have a size greater than zero.\n",
                $2
            );
            errors++;
        }
        else if ($4 > 1000000) {
            printf(
                "SEMANTIC ERROR: Array '%s' exceeds the maximum supported size.\n",
                $2
            );
            errors++;
        }
        else {
            printf(
                "Declared %s array '%s' with size %d\n",
                $1, $2, $4
            );

            printf(
                "SYMBOL|%s|%s|%d\n",
                $2, $1, $4
            );

            declarations++;
        }

        free($2);
        free($1);
    }
    | error ';'
    {
        printf(
            "SYNTAX ERROR: Invalid statement. Check declaration syntax and semicolon.\n"
        );

        errors++;
        yyerrok;
    }
    ;

type:
      INT    { $$ = strdup("int"); }
    | FLOAT  { $$ = strdup("float"); }
    | CHAR   { $$ = strdup("char"); }
    | DOUBLE { $$ = strdup("double"); }
    ;

%%

void yyerror(const char *message)
{
    (void)message;
}

int main(void)
{
    yyparse();

    if (errors == 0 && declarations > 0) {
        printf("\nRESULT: Compilation successful!\n");
        printf("Compilation successful.\n");
    }
    else {
        if (declarations == 0 && errors == 0) {
            printf(
                "SYNTAX ERROR: No array declarations were found.\n"
            );
            errors++;
        }

        printf("\nRESULT: Compilation failed.\n");
    }

    return errors ? 1 : 0;
}