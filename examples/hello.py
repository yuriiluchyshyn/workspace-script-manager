#!/usr/bin/env python3

import time
import os
from datetime import datetime

print("Hello from Python script!")
print(f"Current directory: {os.getcwd()}")
print(f"Current time: {datetime.now()}")

for i in range(1, 6):
    print(f"Count: {i}")
    time.sleep(1)

print("Python script completed!")