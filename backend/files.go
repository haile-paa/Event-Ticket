package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Images (event photos, payment screenshots, demo posters) are stored inside MongoDB, in the
// "files" collection, so the server needs no disk and nothing is lost on restart or redeploy.
// They are still served from /uploads/<id>, so every saved image address keeps working.

const maxImageBytes = 10 << 20

var allowedImages = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// StoredFile is one image. The _id is its public path after /uploads/, e.g. "k3j2....jpg" or "proofs/x.png".
type StoredFile struct {
	ID          string    `bson:"_id"`
	ContentType string    `bson:"ct"`
	Data        []byte    `bson:"data"`
	Size        int       `bson:"size"`
	CreatedAt   time.Time `bson:"createdAt"`
}

// readImage validates the real content (not the file name) and returns the bytes.
func readImage(src io.Reader, allowSVG bool) ([]byte, string, string, error) {
	data, err := io.ReadAll(io.LimitReader(src, maxImageBytes+1))
	if err != nil {
		return nil, "", "", err
	}
	if len(data) > maxImageBytes {
		return nil, "", "", errors.New("The image is too large (max 10 MB)")
	}
	head := data
	if len(head) > 512 {
		head = head[:512]
	}
	ct := http.DetectContentType(head)
	ext, ok := allowedImages[ct]
	if !ok && allowSVG && (strings.HasPrefix(ct, "text/xml") || strings.HasPrefix(ct, "text/plain")) &&
		strings.Contains(strings.ToLower(string(head)), "<svg") {
		return data, "image/svg+xml", ".svg", nil
	}
	if !ok {
		return nil, "", "", errors.New("unsupported image type, please use JPG, PNG, WEBP or GIF")
	}
	return data, ct, ext, nil
}

// storeImage saves an image under an unguessable random name and returns its id (the part after /uploads/).
func (a *App) storeImage(ctx context.Context, src io.Reader, prefix string, allowSVG bool) (string, error) {
	data, ct, ext, err := readImage(src, allowSVG)
	if err != nil {
		return "", err
	}
	id := prefix + randToken(16) + ext
	_, err = a.files.InsertOne(ctx, StoredFile{ID: id, ContentType: ct, Data: data, Size: len(data), CreatedAt: time.Now()})
	if err != nil {
		return "", errors.New("could not save the image, please try again")
	}
	return id, nil
}

// putFile writes (or replaces) a file with a fixed id. Used for the demo posters.
func (a *App) putFile(ctx context.Context, id, ct string, data []byte) error {
	_, err := a.files.ReplaceOne(ctx, bson.M{"_id": id},
		StoredFile{ID: id, ContentType: ct, Data: data, Size: len(data), CreatedAt: time.Now()},
		options.Replace().SetUpsert(true))
	return err
}

func (a *App) deleteFile(ctx context.Context, id string) {
	_, _ = a.files.DeleteOne(ctx, bson.M{"_id": id})
}

// serveUpload answers GET /uploads/<id>.
func (a *App) serveUpload(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/uploads/")
	if id == "" || strings.Contains(id, "..") {
		http.NotFound(w, r)
		return
	}
	var f StoredFile
	err := a.files.FindOne(r.Context(), bson.M{"_id": id}).Decode(&f)
	if errors.Is(err, mongo.ErrNoDocuments) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, "storage error", http.StatusInternalServerError)
		return
	}
	h := w.Header()
	h.Set("Content-Type", f.ContentType)
	h.Set("Content-Length", strconv.Itoa(len(f.Data)))
	h.Set("Cache-Control", "public, max-age=31536000, immutable")
	// uploaded SVGs must never be able to run scripts if someone opens them directly
	h.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox")
	h.Set("Cross-Origin-Resource-Policy", "cross-origin")
	if r.Method == http.MethodHead {
		return
	}
	_, _ = w.Write(f.Data)
}
