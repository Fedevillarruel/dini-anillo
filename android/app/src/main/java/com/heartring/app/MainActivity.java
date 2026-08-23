package com.heartring.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
	}

	@Override
	public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
		// Marker required by the Social Login plugin for custom Google scopes.
	}
}
