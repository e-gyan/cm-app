#!/bin/bash
while kill -0 $(jobs -p) 2>/dev/null; do sleep 1; done
