FROM golang:1.24-alpine AS build
WORKDIR /src
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /tikit .

FROM alpine:3.20
RUN adduser -D app
USER app
COPY --from=build /tikit /tikit
EXPOSE 8080
CMD ["/tikit"]
