package ai.kryx.tablet.executor;

import org.json.JSONObject;

public interface DeviceExecutor {
    JSONObject capabilities();
    boolean openApp(String packageName) throws Exception;
    JSONObject inspectUI() throws Exception;
    boolean tap(String nodePath) throws Exception;
    boolean type(String nodePath, String text, boolean replace) throws Exception;
    boolean scroll(String nodePath, boolean forward) throws Exception;
    boolean swipe(float startX, float startY, float endX, float endY, long durationMs) throws Exception;
    String readScreen() throws Exception;
    boolean openURL(String url) throws Exception;
    void notifyUser(String title, String body);
}
