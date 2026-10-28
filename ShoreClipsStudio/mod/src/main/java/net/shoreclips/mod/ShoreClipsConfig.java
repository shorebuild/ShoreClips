package net.shoreclips.mod;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.nio.file.Files;
import java.nio.file.Path;

public final class ShoreClipsConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Path FILE = Path.of(System.getProperty("user.home"), ".shoreclips", "mod-settings.json");

    public int durationSeconds = 60;
    public boolean achievementStyle = true;
    public String achievementItem = "chest";
    public String savedMessage = "Clip Saved";

    public static ShoreClipsConfig load() {
        try {
            if (Files.exists(FILE)) {
                ShoreClipsConfig value = GSON.fromJson(Files.readString(FILE), ShoreClipsConfig.class);
                if (value != null) return value;
            }
        } catch (Exception ignored) {}
        ShoreClipsConfig value = new ShoreClipsConfig();
        value.save();
        return value;
    }

    public void save() {
        try {
            Files.createDirectories(FILE.getParent());
            Files.writeString(FILE, GSON.toJson(this));
        } catch (Exception exception) {
            System.err.println("[ShoreClips] Could not save settings: " + exception.getMessage());
        }
    }
}
