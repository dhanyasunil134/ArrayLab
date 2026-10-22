#define WIN32_LEAN_AND_MEAN

#include <winsock2.h>
#include <ws2tcpip.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define PORT 8080
#define BODY_LIMIT 65536

static void respond(
    SOCKET client,
    const char *status,
    const char *type,
    const char *body,
    size_t length
) {
    char header[512];

    int header_length = snprintf(
        header,
        sizeof(header),
        "HTTP/1.1 %s\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %zu\r\n"
        "Connection: close\r\n"
        "Cache-Control: no-store\r\n\r\n",
        status,
        type,
        length
    );

    send(client, header, header_length, 0);

    if (length > 0) {
        send(client, body, (int)length, 0);
    }
}

static char *readfile(const char *path, size_t *length)
{
    FILE *file = fopen(path, "rb");

    if (!file) {
        return NULL;
    }

    fseek(file, 0, SEEK_END);
    long size = ftell(file);
    rewind(file);

    if (size < 0) {
        fclose(file);
        return NULL;
    }

    char *data = malloc((size_t)size + 1);

    if (!data) {
        fclose(file);
        return NULL;
    }

    *length = fread(data, 1, (size_t)size, file);

    fclose(file);

    data[*length] = '\0';

    return data;
}

static int get_content_length(const char *headers)
{
    const char *position = strstr(headers, "Content-Length:");

    if (!position) {
        position = strstr(headers, "content-length:");
    }

    if (!position) {
        return 0;
    }

    position = strchr(position, ':') + 1;

    while (*position == ' ') {
        position++;
    }

    return atoi(position);
}

static void compile_request(
    SOCKET client,
    const char *body,
    size_t body_length
) {
    if (body_length > BODY_LIMIT) {
        const char *message = "Input too large.";

        respond(
            client,
            "413 Payload Too Large",
            "text/plain",
            message,
            strlen(message)
        );

        return;
    }

    FILE *input = fopen("arraylab_input.tmp", "wb");

    if (!input) {
        const char *message = "Cannot create compiler input file.";

        respond(
            client,
            "500 Internal Server Error",
            "text/plain",
            message,
            strlen(message)
        );

        return;
    }

    fwrite(body, 1, body_length, input);
    fclose(input);

    system(
        "array_compiler.exe < arraylab_input.tmp "
        "> arraylab_output.tmp 2>&1"
    );

    size_t output_length = 0;

    char *compiler_output = readfile(
        "arraylab_output.tmp",
        &output_length
    );

    if (!compiler_output) {
        const char *message = "Cannot read compiler output.";

        respond(
            client,
            "500 Internal Server Error",
            "text/plain",
            message,
            strlen(message)
        );

        return;
    }

    respond(
        client,
        "200 OK",
        "text/plain; charset=utf-8",
        compiler_output,
        output_length
    );

    free(compiler_output);
}

static void handle_client(SOCKET client)
{
    char request[8193];

    int received = recv(
        client,
        request,
        8192,
        0
    );

    if (received <= 0) {
        closesocket(client);
        return;
    }

    request[received] = '\0';

    char method[16] = {0};
    char path[512] = {0};

    sscanf(request, "%15s %511s", method, path);

    char *header_end = strstr(request, "\r\n\r\n");

    if (!header_end) {
        const char *message = "Bad Request";

        respond(
            client,
            "400 Bad Request",
            "text/plain",
            message,
            strlen(message)
        );

        closesocket(client);
        return;
    }

    size_t header_length =
        (size_t)(header_end + 4 - request);

    int expected_length = get_content_length(request);

    if (
        !strcmp(method, "POST") &&
        !strcmp(path, "/compile")
    ) {
        if (
            expected_length < 0 ||
            expected_length > BODY_LIMIT
        ) {
            const char *message = "Invalid request body size.";

            respond(
                client,
                "413 Payload Too Large",
                "text/plain",
                message,
                strlen(message)
            );

            closesocket(client);
            return;
        }

        char *body = malloc((size_t)expected_length + 1);

        if (!body) {
            closesocket(client);
            return;
        }

        size_t copied =
            (size_t)received > header_length
            ? (size_t)received - header_length
            : 0;

        if (copied > (size_t)expected_length) {
            copied = (size_t)expected_length;
        }

        memcpy(body, request + header_length, copied);

        size_t total = copied;

        while (total < (size_t)expected_length) {
            int count = recv(
                client,
                body + total,
                expected_length - (int)total,
                0
            );

            if (count <= 0) {
                break;
            }

            total += (size_t)count;
        }

        body[total] = '\0';

        compile_request(client, body, total);

        free(body);
        closesocket(client);
        return;
    }

    if (strcmp(method, "GET") != 0) {
        const char *message = "Method Not Allowed";

        respond(
            client,
            "405 Method Not Allowed",
            "text/plain",
            message,
            strlen(message)
        );

        closesocket(client);
        return;
    }

    const char *file = NULL;
    const char *content_type = "text/html; charset=utf-8";

    if (
        strcmp(path, "/") == 0 ||
        strcmp(path, "/index.html") == 0
    ) {
        file = "templates/index.html";
    }
    else if (strcmp(path, "/static/style.css") == 0) {
        file = "static/style.css";
        content_type = "text/css; charset=utf-8";
    }
    else if (strcmp(path, "/static/app.js") == 0) {
        file = "static/app.js";
        content_type = "application/javascript; charset=utf-8";
    }

    if (!file) {
        const char *message = "404 - Page not found";

        respond(
            client,
            "404 Not Found",
            "text/plain",
            message,
            strlen(message)
        );

        closesocket(client);
        return;
    }

    size_t length = 0;
    char *data = readfile(file, &length);

    if (!data) {
        const char *message =
            "File not found. Run server.exe from the project root.";

        respond(
            client,
            "404 Not Found",
            "text/plain",
            message,
            strlen(message)
        );
    }
    else {
        respond(
            client,
            "200 OK",
            content_type,
            data,
            length
        );

        free(data);
    }

    closesocket(client);
}

int main(void)
{
    WSADATA wsa;

    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        fprintf(stderr, "WSAStartup failed.\n");
        return 1;
    }

    SOCKET server = socket(
        AF_INET,
        SOCK_STREAM,
        IPPROTO_TCP
    );

    if (server == INVALID_SOCKET) {
        fprintf(stderr, "Socket creation failed.\n");
        WSACleanup();
        return 1;
    }

    struct sockaddr_in address;

    memset(&address, 0, sizeof(address));

    address.sin_family = AF_INET;
    address.sin_port = htons(PORT);
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    if (
        bind(
            server,
            (struct sockaddr *)&address,
            sizeof(address)
        ) == SOCKET_ERROR ||
        listen(server, SOMAXCONN) == SOCKET_ERROR
    ) {
        fprintf(
            stderr,
            "Cannot listen on port %d. Check whether it is already in use.\n",
            PORT
        );

        closesocket(server);
        WSACleanup();
        return 1;
    }

    printf(
        "ArrayLab running at http://127.0.0.1:%d\n",
        PORT
    );

    printf("Keep this terminal open. Press Ctrl+C to stop.\n");

    for (;;) {
        SOCKET client = accept(server, NULL, NULL);

        if (client != INVALID_SOCKET) {
            handle_client(client);
        }
    }

    closesocket(server);
    WSACleanup();

    return 0;
}