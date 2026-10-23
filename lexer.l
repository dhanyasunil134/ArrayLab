%option noyywrap

%{
#include "parser.tab.h"
#include <stdlib.h>
#include <string.h>
%}

%%

"int"       { return INT; }
"float"     { return FLOAT; }
"char"      { return CHAR; }
"double"    { return DOUBLE; }

[0-9]+      {
                yylval.number = atoi(yytext);
                return NUMBER;
            }

[A-Za-z_][A-Za-z0-9_]* {
                yylval.text = (char *)malloc(strlen(yytext) + 1);

                if (yylval.text != NULL) {
                    strcpy(yylval.text, yytext);
                }

                return IDENTIFIER;
            }

"["         { return '['; }
"]"         { return ']'; }
";"         { return ';'; }

[ \t\r\n]+  { /* Ignore whitespace */ }

.           {
                printf(
                    "LEXICAL ERROR: Unexpected character '%s'.\n",
                    yytext
                );

                return INVALID;
            }

%%