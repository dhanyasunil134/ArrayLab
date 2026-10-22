CC = gcc
FLEX = flex
BISON = bison
CFLAGS = -Wall -Wextra

all: array_compiler.exe server.exe

parser.tab.c parser.tab.h: parser.y expr.h
	$(BISON) -d -o parser.tab.c parser.y

lex.yy.c: lexer.l parser.tab.h
	$(FLEX) -o lex.yy.c lexer.l

array_compiler.exe: parser.tab.c lex.yy.c expr.h
	$(CC) $(CFLAGS) -o array_compiler.exe parser.tab.c lex.yy.c

server.exe: server.c
	$(CC) $(CFLAGS) -o server.exe server.c -lws2_32

clean:
	rm -f parser.tab.c parser.tab.h lex.yy.c array_compiler.exe server.exe arraylab_input.tmp arraylab_output.tmp

.PHONY: all clean