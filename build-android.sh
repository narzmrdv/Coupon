#!/bin/bash
export PATH="/opt/homebrew/Cellar/node/25.5.0/bin:/opt/homebrew/bin:$PATH"
cd android && ./gradlew bundleRelease
