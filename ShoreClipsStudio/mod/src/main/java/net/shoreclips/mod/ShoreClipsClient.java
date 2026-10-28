package net.shoreclips.mod;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommands;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;

public final class ShoreClipsClient implements ClientModInitializer {
    public static final String MOD_ID = "shoreclips";
    public static KeyMapping CLIP_KEY;
    public static KeyMapping.Category KEY_CATEGORY;
    public static final ShoreClipsConfig CONFIG = ShoreClipsConfig.load();

    @Override
    public void onInitializeClient() {
        KEY_CATEGORY = KeyMapping.Category.register(Identifier.fromNamespaceAndPath(MOD_ID, "main"));
        CLIP_KEY = KeyMappingHelper.registerKeyMapping(new KeyMapping(
                "key.shoreclips.save_clip",
                InputConstants.Type.KEYSYM,
                InputConstants.KEY_F7,
                KEY_CATEGORY));

        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> {
            dispatcher.register(ClientCommands.literal("shoreclip")
                    .executes(context -> {
                        Minecraft client = Minecraft.getInstance();
                        client.execute(() -> client.setScreen(new ShoreClipsScreen(client.screen)));
                        return 1;
                    })
                    .then(ClientCommands.literal("link").executes(context -> {
                        Minecraft client = Minecraft.getInstance();
                        client.execute(() -> client.setScreen(new LinkCodeScreen(client.screen)));
                        return 1;
                    })));
        });

        final int[] fpsTicks = {0};
        final int[] lastReportedFps = {-1};
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            if (++fpsTicks[0] >= 10) {
                fpsTicks[0] = 0;
                int fps = client.getFps();
                if (fps > 0 && (lastReportedFps[0] < 0 || Math.abs(fps - lastReportedFps[0]) >= 2)) {
                    lastReportedFps[0] = fps;
                    BridgeClient.reportFps(fps);
                }
            }
            while (CLIP_KEY.consumeClick()) {
                if (client.player != null) {
                    BridgeClient.saveReplay(CONFIG.durationSeconds, result -> client.execute(() -> {
                        if (client.player == null) return;
                        String message = result.ok()
                                ? CONFIG.savedMessage + (result.shareUrl().isBlank() ? " (saved locally)" : " — " + result.shareUrl())
                                : "ShoreClips: " + result.message();
                        client.gui.setOverlayMessage(Component.literal(message), false);
                    }));
                }
            }
        });
    }
}
