package net.shoreclips.mod;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;
import java.util.function.Consumer;
import net.minecraft.client.Minecraft;

public final class BridgeClient {
    private static final Gson GSON = new Gson();
    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(2)).build();
    private static final Path CONFIG_PATH = Path.of(System.getProperty("user.home"), ".shoreclips", "bridge.json");

    private BridgeClient() {}

    public record Result(boolean ok, String message, String shareUrl) {
        static Result fail(String message) { return new Result(false, message, ""); }
    }

    public static JsonObject readConfig() {
        try {
            if (Files.exists(CONFIG_PATH)) return JsonParser.parseString(Files.readString(CONFIG_PATH)).getAsJsonObject();
        } catch (Exception ignored) {}
        return new JsonObject();
    }

    public static void saveConfig(JsonObject config) throws IOException {
        Files.createDirectories(CONFIG_PATH.getParent());
        Files.writeString(CONFIG_PATH, GSON.toJson(config), StandardCharsets.UTF_8);
    }

    public static void saveReplay(int durationSeconds, Consumer<Result> callback) {
        JsonObject config = readConfig();
        String token = value(config, "bridgeToken");
        int port = config.has("port") ? config.get("port").getAsInt() : 17842;
        if (token.isBlank()) {
            callback.accept(Result.fail("Start the ShoreClips recorder companion first."));
            return;
        }

        JsonObject body = new JsonObject();
        body.addProperty("durationSeconds", Math.max(5, Math.min(300, durationSeconds)));
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/v1/clip"))
                .timeout(Duration.ofMinutes(3))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body))).build();

        HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString()).whenComplete((response, error) -> {
            if (error != null) {
                callback.accept(Result.fail("Recorder unavailable. Start it and check FFmpeg settings."));
                return;
            }
            try {
                JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
                if (response.statusCode() >= 200 && response.statusCode() < 300
                        && json.has("ok") && json.get("ok").getAsBoolean()) {
                    callback.accept(new Result(true,
                            json.has("message") ? json.get("message").getAsString() : "Saved",
                            value(json, "url")));
                } else {
                    callback.accept(Result.fail(value(json, "error").isBlank()
                            ? "Could not save clip." : value(json, "error")));
                }
            } catch (Exception exception) {
                callback.accept(Result.fail("The recorder returned an unreadable response."));
            }
        });
    }

    public static void reportFps(int fps) {
        if (fps <= 0) return;
        JsonObject config = readConfig();
        String token = value(config, "bridgeToken");
        int port = config.has("port") ? config.get("port").getAsInt() : 17842;
        if (token.isBlank()) return;

        JsonObject body = new JsonObject();
        body.addProperty("fps", Math.max(1, Math.min(500, fps)));
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/v1/fps"))
                .timeout(Duration.ofSeconds(2))
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body))).build();
        HTTP.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                .exceptionally(error -> null);
    }

    public static void linkCode(String code, Consumer<Result> callback) {
        JsonObject config = readConfig();
        String apiBase = value(config, "apiBase");
        if (apiBase.isBlank() || apiBase.contains("YOUR_SUBDOMAIN")) {
            callback.accept(Result.fail("Configure apiBase in ~/.shoreclips/bridge.json first."));
            return;
        }

        Minecraft minecraft = Minecraft.getInstance();
        String username = minecraft.getUser().getName();
        String uuid = getMinecraftUuid(minecraft.getUser());
        if (uuid.isBlank()) {
            callback.accept(Result.fail("Could not read your Minecraft profile UUID. Sign in with the official launcher."));
            return;
        }

        JsonObject body = new JsonObject();
        body.addProperty("code", code);
        body.addProperty("minecraftUsername", username);
        body.addProperty("minecraftUuid", uuid);

        HttpRequest request = HttpRequest.newBuilder(URI.create(trimSlash(apiBase) + "/api/link/consume"))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(GSON.toJson(body))).build();

        HTTP.sendAsync(request, HttpResponse.BodyHandlers.ofString()).whenComplete((response, error) -> {
            if (error != null) {
                callback.accept(Result.fail("Could not reach the ShoreClips API."));
                return;
            }
            try {
                JsonObject result = JsonParser.parseString(response.body()).getAsJsonObject();
                if (response.statusCode() >= 200 && response.statusCode() < 300
                        && result.has("deviceToken")) {
                    config.addProperty("deviceToken", value(result, "deviceToken"));
                    config.addProperty("minecraftUsername", username);
                    config.addProperty("minecraftUuid", uuid);
                    saveConfig(config);
                    callback.accept(new Result(true, "Minecraft account linked.", ""));
                } else {
                    callback.accept(Result.fail(value(result, "error").isBlank()
                            ? "Link failed." : value(result, "error")));
                }
            } catch (Exception exception) {
                callback.accept(Result.fail("API returned an invalid response."));
            }
        });
    }

    private static String getMinecraftUuid(Object user) {
        try {
            Object id = user.getClass().getMethod("getProfileId").invoke(user);
            if (id instanceof UUID uuid) return uuid.toString();
            if (id instanceof java.util.Optional<?> optional && optional.isPresent()) return optional.get().toString();
            if (id != null) return id.toString();
        } catch (Exception ignored) {}
        return "";
    }

    private static String value(JsonObject json, String key) {
        return json != null && json.has(key) && !json.get(key).isJsonNull()
                ? json.get(key).getAsString() : "";
    }

    private static String trimSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
