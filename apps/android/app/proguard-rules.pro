# Kryx Android release hardening.
# Keep Android entry points while allowing the implementation to be renamed/minified.
-keep class ai.kryx.tablet.MainActivity { *; }
-keep class ai.kryx.tablet.executor.KryxAccessibilityService { *; }
-keep class ai.kryx.tablet.runtime.KryxMissionService { *; }
-keep class ai.kryx.tablet.overlay.KryxOverlayService { *; }

# org.json is platform-provided; no reflection keep rules are needed for Kryx models.
-dontnote org.json.**
