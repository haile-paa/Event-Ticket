FROM golang:1.24-alpine AS build
WORKDIR /src
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /tikit .

FROM alpine:3.20
# Runs as root on purpose: hosts like Render mount their persistent disk as root-owned,
# and a non-root user could not create folders on it.
RUN mkdir -p /data/uploads
ENV UPLOAD_DIR=/data/uploads
WORKDIR /data
COPY --from=build /tikit /tikit
EXPOSE 8080
CMD ["/tikit"]